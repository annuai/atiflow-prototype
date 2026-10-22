#!/usr/bin/env python3
"""Point cloud (lidar occupancy) map -> a clean DXF of walls, rooms, machines and pillars.

  python -I tools/pointcloud-to-dxf/pointcloud_to_dxf.py <map.zip | map folder | yelli_map.npz> <out.dxf> [options]

The Deployment Manager's map is a picture of lidar hits (`yelli_map.npz`, 2 cm per cell). Tracing that picture gives thousands of
scribbles. This script does the opposite: it decides what the picture MEANS and writes only that.

  WALL    closed thin rectangles, one per straight wall (centre line + measured thickness, ends where the wall ends,
          door gaps stay gaps). Found by looking for straight runs in the directions the building really has.
  PILLAR  small compact squares
  EQUIP   machines / racks / boxes: one oriented rectangle each (lidar only sees their faces, so they are filled)
  ROOM    each enclosed space as a polygon with a name (TEXT inside it): the importer turns these into Work areas

Everything is written in METRES in the MAP's own frame (the origin cell of the map is 0, 0), so the DXF lies exactly on the
point cloud map: in Ati Flow's Import drawing it needs no alignment (Auto-align finds identity). `--preview x.png` draws the
point cloud with what was found on top, to check it by eye.

What is dropped, on purpose (and counted in the report): everything outside the main building (a neighbouring building seen through
a window, stray reflections), specks, and marks too faint or too thin to be real. Options below tune that.
Needs: pip install -r tools/pointcloud-to-dxf/requirements.txt
"""
import argparse, io, json, math, os, sys, time, zipfile

import cv2
import ezdxf
import numpy as np
from scipy import ndimage

T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:5.1f}s] {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------------------------- reading the map
def read_inputs(path):
    """-> dict(grid, meta, poses, name). Accepts the zip, the folder, or the npz itself (with yelli_meta.json beside it)."""
    files = {}
    if os.path.isdir(path):
        for root, _, names in os.walk(path):
            for n in names:
                files[n] = open(os.path.join(root, n), "rb").read()
    elif path.lower().endswith(".zip"):
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if not n.endswith("/") and "__MACOSX" not in n:
                    files[os.path.basename(n)] = z.read(n)
    else:
        d = os.path.dirname(os.path.abspath(path))
        for n in os.listdir(d):
            if n.startswith("yelli_") or n == "webui_map.json":
                files[n] = open(os.path.join(d, n), "rb").read()
        files["yelli_map.npz"] = open(path, "rb").read()
    if "yelli_map.npz" not in files or "yelli_meta.json" not in files:
        sys.exit("The map needs yelli_map.npz and yelli_meta.json (the Deployment Manager's map folder).")
    npz = np.load(io.BytesIO(files["yelli_map.npz"]))
    grid = npz[npz.files[0]]
    if grid.ndim != 2:
        sys.exit("The occupancy grid must be a 2D table.")
    meta = json.loads(files["yelli_meta.json"])
    poses = np.load(io.BytesIO(files["yelli_poses.npy"])) if "yelli_poses.npy" in files else None
    name = "map"
    if "webui_map.json" in files:
        name = json.loads(files["webui_map.json"]).get("map_name", name)
    return dict(grid=grid, meta=meta, poses=poses, name=name)


def pool(grid, f):
    """Max over f x f blocks (a huge map is looked at coarser instead of not at all)."""
    h, w = (grid.shape[0] // f) * f, (grid.shape[1] // f) * f
    out = np.zeros((h // f, w // f), dtype=grid.dtype)
    step = 512 * f
    for r in range(0, h, step):
        blk = grid[r : min(r + step, h), :w]
        out[r // f : r // f + blk.shape[0] // f] = blk.reshape(blk.shape[0] // f, f, w // f, f).max(axis=(1, 3))
    return out


class Frame:
    """Working array W[row, col] with col = x cell and row = y cell (y up in metres), cropped to the occupied area."""

    def __init__(self, grid, res, origin, orientation, margin_m=1.5):
        if orientation == "rows-y":  # older exports: axis 0 = rows (y down), axis 1 = columns (x)
            W = grid[::-1, :]
            self.ox, self.oy = origin[0], grid.shape[0] - 1 - origin[1]
        else:  # v5: axis 0 = x, axis 1 = y (up)
            W = grid.T
            self.ox, self.oy = origin[0], origin[1]
        occ = np.nonzero(W > 0)
        m = int(margin_m / res)
        self.r0 = max(0, occ[0].min() - m)
        self.r1 = min(W.shape[0], occ[0].max() + m + 1)
        self.c0 = max(0, occ[1].min() - m)
        self.c1 = min(W.shape[1], occ[1].max() + m + 1)
        self.W = np.ascontiguousarray(W[self.r0 : self.r1, self.c0 : self.c1])
        self.res = res

    def to_m(self, col, row):
        """Metres (x, y) of the CENTRE of cells (arrays or numbers) in the cropped array."""
        return ((col + self.c0 + 0.5 - self.ox) * self.res, (row + self.r0 + 0.5 - self.oy) * self.res)

    def to_px(self, x, y):
        return ((x / self.res + self.ox - self.c0 - 0.5), (y / self.res + self.oy - self.r0 - 0.5))


def detect_orientation(grid, res, origin, poses):
    """Which way round the grid is stored, from the path the robot drove: it must run on floor with walls about it, not in them."""
    if poses is None:
        return "x-y"
    pts = [(x, y) for x, y, _ in poses if abs(x) + abs(y) > 0.01]
    if len(pts) < 5:
        return "x-y"
    best = ("x-y", -1)
    small = pool(grid, 4) if grid.size > 4_000_000 else grid
    f = grid.shape[0] // small.shape[0] if small is not grid else 1
    occ = small >= 8
    dt = ndimage.distance_transform_edt(~occ) * res * f
    for name in ("x-y", "rows-y"):
        ok, near = 0, 0
        for x, y in pts:
            if name == "x-y":
                i, j = origin[0] + x / res, origin[1] + y / res
            else:
                i, j = origin[1] - y / res, origin[0] + x / res
            i, j = int(i / f), int(j / f)
            if 0 <= i < dt.shape[0] and 0 <= j < dt.shape[1]:
                ok += 1
                near += (dt[i, j] < 4.0) and not occ[i, j]
        score = near / max(ok, 1)
        if score > best[1] + 1e-9:
            best = (name, score)
    return best[0]


# ---------------------------------------------------------------------------------------------- geometry helpers
def disk(r_px):
    r = max(1, int(round(r_px)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def line_kernel(theta, length_px):
    n = int(length_px) | 1
    k = np.zeros((n, n), np.uint8)
    c = n // 2
    dx, dy = math.cos(theta) * c, math.sin(theta) * c
    cv2.line(k, (int(round(c - dx)), int(round(c - dy))), (int(round(c + dx)), int(round(c + dy))), 1)
    return k


def morph(img, op, k):
    return cv2.morphologyEx(img, op, k)


def angle_diff(a, b, period=math.pi):
    d = (a - b) % period
    return min(d, period - d)


# ---------------------------------------------------------------------------------------------- stage 1: the mask
def occupancy_mask(W, lo, hi):
    """Cells that are real hits: strong ones, plus weaker ones connected to a strong one (lidar blur around a wall)."""
    weak = (W >= lo).astype(np.uint8)
    n, lab = cv2.connectedComponents(weak, connectivity=8)
    keep = np.zeros(n, bool)
    keep[np.unique(lab[W >= hi])] = True
    keep[0] = False
    return keep[lab].astype(np.uint8)


def building(mask, res, notes):
    """The main building: the structure that encloses the most floor. Doors and gaps in its walls are bridged with a growing closing
    until the outline closes; returns (filled interior mask, the closing radius in metres)."""
    best = None
    for r_m in (0.25, 0.5, 0.9, 1.5, 2.5, 4.0):
        closed = morph(mask, cv2.MORPH_CLOSE, disk(r_m / res))
        n, lab, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
        if n <= 1:
            continue
        # try the biggest few by bounding box
        order = np.argsort(-(stats[1:, cv2.CC_STAT_WIDTH] * stats[1:, cv2.CC_STAT_HEIGHT]))[:6] + 1
        for k in order:
            comp = lab == k
            filled = ndimage.binary_fill_holes(comp)
            enclosed = int(filled.sum() - comp.sum())
            cs, _ = cv2.findContours(comp.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            hull_area = cv2.contourArea(cv2.convexHull(max(cs, key=cv2.contourArea))) if cs else 1
            ratio = enclosed / max(hull_area, 1)
            if best is None or enclosed > best[0]:
                best = (enclosed, filled, r_m, ratio)
        if best and best[3] > 0.5:
            break
    if best is None:
        sys.exit("No building was found in the map (nothing is enclosed).")
    notes["closing_m"] = best[2]
    return best[1], best[2]


# ---------------------------------------------------------------------------------------------- stage 2: directions and walls
def wall_directions(cand, res, max_dirs=4):
    """The directions walls run in (radians, 0 to pi). A pixel is on a wall in direction a when it survives an opening with a 1.2 m line
    at that angle; the angles where most pixels survive, 1 degree apart, are the building's directions (a bump or a scribble does not
    survive any long line, so they vote for nothing)."""
    f = 2
    h, w = cand.shape[0] // f * f, cand.shape[1] // f * f
    small = cand[:h, :w].reshape(h // f, f, w // f, f).max(axis=(1, 3))
    L = int(1.2 / (res * f)) | 1
    hist = np.zeros(180)
    for deg in range(180):
        hist[deg] = int(morph(small, cv2.MORPH_OPEN, line_kernel(math.radians(deg), L)).sum())
    sm = np.convolve(np.r_[hist[-2:], hist, hist[:2]], np.ones(3) / 3, mode="same")[2:-2]
    peaks = []
    top = sm.max()
    for i in np.argsort(-sm):
        if sm[i] < 0.12 * top or len(peaks) >= max_dirs:
            break
        if all(min(abs(i - p), 180 - abs(i - p)) > 14 for p in peaks):
            idx = [(i + d) % 180 for d in range(-2, 3)]
            ww = sm[idx]
            d = np.arange(-2, 3)
            peaks.append((i + (ww * d).sum() / max(ww.sum(), 1e-9)) % 180)
    return [math.radians(p) for p in peaks]


def strip_rect(xs, ys, theta, res):
    """An oriented rectangle round a straight wall piece. The angle is refined by fitting the piece's centre line (a wall is rarely exactly
    on the building's main direction); thickness is the MEDIAN over 4 cm columns, so a bump or a socket does not fatten the whole wall."""
    for _ in range(3):
        c, s_ = math.cos(theta), math.sin(theta)
        u = xs * c + ys * s_
        v = -xs * s_ + ys * c
        ub = np.floor((u - u.min()) / (2 * res)).astype(int)
        n = ub.max() + 1
        vmin = np.full(n, np.inf)
        vmax = np.full(n, -np.inf)
        cnt = np.zeros(n, int)
        np.minimum.at(vmin, ub, v)
        np.maximum.at(vmax, ub, v)
        np.add.at(cnt, ub, 1)
        have = cnt > 0
        if have.sum() < 8:
            break
        mid = ((vmax + vmin) / 2)[have]
        uu = (np.nonzero(have)[0] + 0.5) * 2 * res
        slope = np.polyfit(uu, mid, 1)[0]
        if abs(slope) < 1e-4:
            break
        theta += math.atan(slope)
    c, s_ = math.cos(theta), math.sin(theta)
    u = xs * c + ys * s_
    v = -xs * s_ + ys * c
    ub = np.floor((u - u.min()) / (2 * res)).astype(int)
    n = ub.max() + 1
    vmin = np.full(n, np.inf)
    vmax = np.full(n, -np.inf)
    cnt = np.zeros(n, int)
    np.minimum.at(vmin, ub, v)
    np.maximum.at(vmax, ub, v)
    np.add.at(cnt, ub, 1)
    have = cnt > 0
    thick = (vmax - vmin + res)[have]
    t = float(np.median(thick))
    keep = have.copy()
    keep[have] = thick >= 0.55 * t
    if not keep.any():
        return None
    idx = np.nonzero(keep)[0]
    u0 = u.min() + idx[0] * 2 * res
    u1 = u.min() + (idx[-1] + 1) * 2 * res
    vc = float(np.median(((vmax + vmin) / 2)[keep]))
    return dict(theta=theta, u0=u0, u1=u1, vc=vc, t=max(t, 2 * res), length=u1 - u0)


def rect_corners(r):
    c, s = math.cos(r["theta"]), math.sin(r["theta"])
    pts = []
    for u, v in ((r["u0"], r["vc"] - r["t"] / 2), (r["u1"], r["vc"] - r["t"] / 2), (r["u1"], r["vc"] + r["t"] / 2), (r["u0"], r["vc"] + r["t"] / 2)):
        pts.append((u * c - v * s, u * s + v * c))
    return pts


def in_rect(r, x, y, margin):
    c, s = math.cos(r["theta"]), math.sin(r["theta"])
    u, v = x * c + y * s, -x * s + y * c
    return r["u0"] - margin <= u <= r["u1"] + margin and abs(v - r["vc"]) <= r["t"] / 2 + margin


def ends(r):
    c, s = math.cos(r["theta"]), math.sin(r["theta"])
    return [(u * c - r["vc"] * s, u * s + r["vc"] * c) for u in (r["u0"], r["u1"])]


def continues(r, b, gap=2.0):
    """r lies on the same line as wall b, with at most `gap` metres (a door, something in the way) between them."""
    if angle_diff(r["theta"], b["theta"]) > math.radians(4):
        return False
    c, s = math.cos(b["theta"]), math.sin(b["theta"])
    cx = sum(e[0] for e in ends(r)) / 2
    cy = sum(e[1] for e in ends(r)) / 2
    u, v = cx * c + cy * s, -cx * s + cy * c
    if abs(v - b["vc"]) > 0.25:
        return False
    half = r["length"] / 2
    return u + half >= b["u0"] - gap and u - half <= b["u1"] + gap


def meets(r, b):
    """An end of r touches wall b at a right angle (a closet or niche wall)."""
    return angle_diff(r["theta"], b["theta"]) > math.radians(70) and any(in_rect(b, x, y, 0.25) for x, y in ends(r))


def short_pieces_that_belong(keep, support):
    """Long walls are walls. A short piece is one only when it continues, or meets square-on, a piece already accepted (so a short wall
    next to a short wall next to a long one is found, while the edge of a machine against a wall, at some other angle, is not)."""
    ok = [r for r in keep if r["length"] >= support]
    rest = [r for r in keep if r["length"] < support]
    changed = True
    while changed:
        changed = False
        for r in list(rest):
            if any(continues(r, b) or meets(r, b) for b in ok):
                ok.append(r)
                rest.remove(r)
                changed = True
    return ok


def extract_walls(F, cand, ring, dirs, opts, notes):
    """Walls = straight runs along the building's directions. Per direction: keep only pixels on a straight run that long, bridge small gaps
    along it (window frames, notches), cut into pieces, measure each piece. Pieces not tied to the building shell are not walls."""
    res = F.res
    L = int(opts.min_wall / res)
    gap = int(opts.bridge / res)
    pieces = []
    union = np.zeros_like(cand)
    left = cand.copy()
    for th in dirs:  # strongest direction first; what it explains is taken away before the next one looks (no wall found twice)
        op = morph(left, cv2.MORPH_OPEN, line_kernel(th, L))
        if not op.any():
            continue
        cl = morph(op, cv2.MORPH_CLOSE, line_kernel(th, gap))
        cl = cl & morph(left, cv2.MORPH_DILATE, disk(1))  # bridging may not invent wall where there was none
        n, lab, st, _ = cv2.connectedComponentsWithStats(cl, connectivity=8)
        mine = []
        for k in range(1, n):
            if st[k, cv2.CC_STAT_AREA] < 60:
                continue
            x0, y0, bw, bh = st[k, 0], st[k, 1], st[k, 2], st[k, 3]
            ys, xs = np.nonzero(lab[y0 : y0 + bh, x0 : x0 + bw] == k)
            ys, xs = ys + y0, xs + x0
            X, Y = F.to_m(xs.astype(np.float64), ys.astype(np.float64))
            r = strip_rect(X, Y, th, res)
            if r and r["length"] >= opts.min_wall:
                r["dir"] = th
                mine.append(r)
        pieces += mine
        union |= op
        left = left & (1 - raster_rects(cand.shape, F, mine, grow_px=max(2, int(0.06 / res))))
    # a direction that never gives a piece of at least `support` m is a scribble's, not the building's
    best_len = {}
    for r in pieces:
        k = round(r["dir"], 3)
        best_len[k] = max(best_len.get(k, 0), r["length"])
    pieces = [r for r in pieces if best_len[round(r["dir"], 3)] >= opts.support]
    # a piece belongs to the shell if it touches the shell ring or another piece that does
    shell = ring.astype(bool)
    comp_n, comp = cv2.connectedComponents(morph(union, cv2.MORPH_DILATE, disk(3)), connectivity=8)
    tied = np.unique(comp[shell & (comp > 0)])
    keep = []
    for r in pieces:
        cx, cy = (r["u0"] + r["u1"]) / 2, r["vc"]
        c, s = math.cos(r["theta"]), math.sin(r["theta"])
        x, y = cx * c - r["vc"] * s, cx * s + r["vc"] * c
        px, py = F.to_px(x, y)
        px, py = int(round(px)), int(round(py))
        if 0 <= py < comp.shape[0] and 0 <= px < comp.shape[1] and comp[py, px] in tied:
            keep.append(r)
        else:
            # the centre may sit in a door gap of the piece's own component: look along the piece
            ok = False
            for f in np.linspace(0, 1, 9):
                u = r["u0"] + f * r["length"]
                x, y = u * c - r["vc"] * s, u * s + r["vc"] * c
                px, py = F.to_px(x, y)
                px, py = int(round(px)), int(round(py))
                if 0 <= py < comp.shape[0] and 0 <= px < comp.shape[1] and comp[py, px] in tied:
                    ok = True
                    break
            if ok:
                keep.append(r)
    notes["wall_pieces_untied"] = len(pieces) - len(keep)
    # a short piece is a wall only when it continues a long wall or meets one square-on (a closet, a niche); a short piece at some other
    # angle is the edge of something standing against the wall
    final = short_pieces_that_belong(keep, opts.support)
    notes["wall_pieces_edges_of_objects"] = len(keep) - len(final)
    return final, union


def raster_rects(shape, F, rects, grow_px=0):
    img = np.zeros(shape, np.uint8)
    for r in rects:
        pts = np.array([F.to_px(x, y) for x, y in rect_corners(r)], np.float32)
        cv2.fillConvexPoly(img, np.round(pts).astype(np.int32), 1)
    if grow_px:
        img = morph(img, cv2.MORPH_DILATE, disk(grow_px))
    return img


# ---------------------------------------------------------------------------------------------- stage 3: machines and pillars
def near_wall(x, y, walls, within):
    for r in walls:
        c, s = math.cos(r["theta"]), math.sin(r["theta"])
        u, v = x * c + y * s, -x * s + y * c
        if r["u0"] - within <= u <= r["u1"] + within and abs(v - r["vc"]) <= r["t"] / 2 + within:
            return True
    return False


def objects_at_level(F, W, level, interior, taken, walls_img, walls, dirs, opts, dropped):
    """What is left inside the building after the walls: compact blobs. Lidar sees only the faces of an object, so each blob is closed up and
    fitted with ONE oriented rectangle; faint marks and thin scratches (people, forklifts, reflections) are dropped."""
    res = F.res
    strong = (W >= level).astype(np.uint8)
    inner = morph(interior.astype(np.uint8), cv2.MORPH_ERODE, disk(0.15 / res))
    rest = strong & inner & (1 - morph(walls_img, cv2.MORPH_DILATE, disk(0.1 / res))) & (1 - taken)
    rest = morph(rest, cv2.MORPH_CLOSE, disk(0.05 / res))
    rest = ndimage.binary_fill_holes(rest).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(rest, connectivity=8)
    machines, pillars = [], []
    for k in range(1, n):
        area = stats[k, cv2.CC_STAT_AREA] * res * res
        if area < opts.min_pillar:
            dropped["small"] += 1
            continue
        ys, xs = np.nonzero(lab[stats[k, 1] : stats[k, 1] + stats[k, 3], stats[k, 0] : stats[k, 0] + stats[k, 2]] == k)
        ys += stats[k, 1]
        xs += stats[k, 0]
        pts = np.column_stack([xs, ys]).astype(np.float32)
        hull = cv2.convexHull(pts)
        # faint marks: a real object has hits along (most of) its outline; a speck of reflections does not
        hits = int(strong[ys, xs].sum())
        if hits < max(opts.min_hits, opts.min_strong * cv2.arcLength(hull, True)):
            dropped["faint"] += 1
            continue
        (cx, cy), (w, h), ang = cv2.minAreaRect(hull)
        w, h = w * res, h * res
        round_ = 0.68 < cv2.contourArea(hull) * res * res / max(w * h, 1e-9) < 0.84 and max(w, h) / max(min(w, h), 1e-9) < 1.3
        if round_:  # a round thing (a tank, a column) is a square of its diameter, standing straight, not a tilted box
            w = h = 2 * math.sqrt(area / math.pi)
            ang = 0.0
        if area < opts.min_object and not (round_ or max(w, h) <= opts.pillar_max):
            dropped["small"] += 1
            continue
        if max(w, h) / max(min(w, h), 1e-9) > 2.2 and min(w, h) < 0.45:  # a line of dots or a scratch, not a machine
            dropped["thin"] += 1
            continue
        small_square = max(w, h) <= opts.pillar_max
        if min(w, h) < (opts.min_object_side if small_square else opts.min_thin):
            dropped["thin"] += 1
            continue
        if max(w, h) > opts.max_object:
            dropped["huge"] += 1
            continue
        x, y = F.to_m(cx - 0.5, cy - 0.5)
        theta = math.radians(ang)
        if w < h:  # long side first
            w, h = h, w
            theta += math.pi / 2
        theta %= math.pi
        # snap to the building's own directions when within 3 degrees
        for d in [0.0, math.pi / 2] + list(dirs):
            if angle_diff(theta, d) < math.radians(3):
                theta = d % math.pi
                break
        # a thin sliver lying along a wall is the wall's own thickness or its pilasters, not a machine
        if min(w, h) < 0.6 and near_wall(x, y, walls, 0.35):
            dropped["on_wall"] += 1
            continue
        obj = dict(x=float(x), y=float(y), w=float(w), d=float(h), rot=float(theta), area=float(area))
        (pillars if max(w, h) <= opts.pillar_max and max(w, h) / max(min(w, h), 1e-6) <= 1.6 else machines).append(obj)
    return machines, pillars


def extract_objects(F, W, interior, walls_img, walls, dirs, opts, notes):
    """Objects, at the sure-hit level first and then at a weaker one: a hollow box seen only by faint hits still shows up, and the strong
    objects found first are masked out so the weaker pass cannot glue them together."""
    dropped = dict(small=0, thin=0, faint=0, huge=0, on_wall=0)
    machines, pillars = [], []
    taken = np.zeros(W.shape, np.uint8)
    for level in (opts.hit_high, opts.hit_mid):
        m, p = objects_at_level(F, W, level, interior, taken, walls_img, walls, dirs, opts, dropped)
        machines += m
        pillars += p
        taken |= object_mask(W.shape, F, m + p, grow_px=int(0.12 / F.res))
    allobj = [(o, "machine") for o in machines] + [(o, "pillar") for o in pillars]
    keep = []
    for o, kind in allobj:  # an object whose centre lies inside a bigger one is part of it
        inside = False
        for q, _ in allobj:
            if q is o or q["area"] <= o["area"] * 1.15:
                continue
            c, s_ = math.cos(q["rot"]), math.sin(q["rot"])
            dx, dy = o["x"] - q["x"], o["y"] - q["y"]
            if abs(dx * c + dy * s_) <= q["w"] / 2 + 0.05 and abs(-dx * s_ + dy * c) <= q["d"] / 2 + 0.05:
                inside = True
                break
        if inside:
            dropped["inside_another"] = dropped.get("inside_another", 0) + 1
        else:
            keep.append((o, kind))
    notes["objects_dropped"] = dropped
    return [o for o, k in keep if k == "machine"], [o for o, k in keep if k == "pillar"]


def object_mask(shape, F, objs, grow_px):
    img = np.zeros(shape, np.uint8)
    for o in objs:
        co, si = math.cos(o["rot"]), math.sin(o["rot"])
        pts = [F.to_px(o["x"] + u * co - v * si, o["y"] + u * si + v * co) for u, v in ((-o["w"] / 2, -o["d"] / 2), (o["w"] / 2, -o["d"] / 2), (o["w"] / 2, o["d"] / 2), (-o["w"] / 2, o["d"] / 2))]
        cv2.fillConvexPoly(img, np.round(np.array(pts, np.float32)).astype(np.int32), 1)
    return morph(img, cv2.MORPH_DILATE, disk(grow_px)) if grow_px else img


# ---------------------------------------------------------------------------------------------- stage 4: rooms
def extract_rooms(F, walls_img, interior, opts, notes):
    """Enclosed spaces: free floor inside the building, split by the walls. Doors narrower than `door` m do not join two rooms."""
    res = F.res
    free = (interior > 0).astype(np.uint8) * (1 - morph(walls_img, cv2.MORPH_DILATE, disk(1)))
    core = morph(free, cv2.MORPH_ERODE, disk(opts.door / 2 / res))  # a door's width closes up
    n, lab, stats, _ = cv2.connectedComponentsWithStats(core, connectivity=8)
    rooms = []
    for k in range(1, n):
        if stats[k, cv2.CC_STAT_AREA] * res * res < opts.min_room:
            continue
        comp = (lab == k).astype(np.uint8)
        comp = morph(comp, cv2.MORPH_DILATE, disk(opts.door / 2 / res)) & free  # back to the real floor
        comp = ndimage.binary_fill_holes(comp).astype(np.uint8)
        cs, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        c = max(cs, key=cv2.contourArea)
        approx = cv2.approxPolyDP(c, opts.simplify / res, True)[:, 0, :].astype(np.float64)
        if len(approx) < 3:
            continue
        pts = [F.to_m(p[0], p[1]) for p in approx]
        dt = cv2.distanceTransform(comp, cv2.DIST_L2, 5)
        r, c0 = np.unravel_index(np.argmax(dt), dt.shape)
        rooms.append(dict(points=[(float(x), float(y)) for x, y in pts], area=float(comp.sum() * res * res), label_at=tuple(map(float, F.to_m(c0, r)))))
    rooms.sort(key=lambda r: -r["area"])
    return rooms


# ---------------------------------------------------------------------------------------------- output
def write_dxf(path, name, walls, machines, pillars, rooms, opts):
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = 6  # metres
    for layer, color in (("WALL", 7), ("PILLAR", 5), ("EQUIP", 30), ("ROOM", 3), ("ROOM_NAME", 8)):
        doc.layers.add(layer, color=color)
    msp = doc.modelspace()
    for r in walls:
        msp.add_lwpolyline([(round(x, 3), round(y, 3)) for x, y in rect_corners(r)], close=True, dxfattribs={"layer": "WALL"})
    for layer, objs in (("EQUIP", machines), ("PILLAR", pillars)):
        for o in objs:
            co, si = math.cos(o["rot"]), math.sin(o["rot"])
            pts = []
            for u, v in ((-o["w"] / 2, -o["d"] / 2), (o["w"] / 2, -o["d"] / 2), (o["w"] / 2, o["d"] / 2), (-o["w"] / 2, o["d"] / 2)):
                pts.append((round(o["x"] + u * co - v * si, 3), round(o["y"] + u * si + v * co, 3)))
            msp.add_lwpolyline(pts, close=True, dxfattribs={"layer": layer})
    for i, r in enumerate(rooms):
        msp.add_lwpolyline([(round(x, 3), round(y, 3)) for x, y in r["points"]], close=True, dxfattribs={"layer": "ROOM"})
        label = opts.room_names[i] if i < len(opts.room_names) else ("Hall" if i == 0 else f"Room {i}")
        t = msp.add_text(label, height=0.6, dxfattribs={"layer": "ROOM_NAME"})
        t.set_placement(r["label_at"])
    doc.saveas(path)


def write_preview(path, F, mask, W, walls, machines, pillars, rooms, scale_px_per_m=40):
    """The point cloud in grey with what was found on top: walls blue, machines orange, pillars purple, rooms green."""
    res = F.res
    s = scale_px_per_m * res  # output pixels per source pixel
    big = cv2.resize(np.where(W >= 8, 0, np.where(W > 0, 200, 255)).astype(np.uint8), None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    img = cv2.cvtColor(big, cv2.COLOR_GRAY2BGR)

    def px(x, y):
        a, b = F.to_px(x, y)
        return (int(round(a * s)), int(round(b * s)))

    for r in rooms:
        cv2.polylines(img, [np.array([px(x, y) for x, y in r["points"]], np.int32)], True, (60, 170, 60), 2)
    for r in walls:
        cv2.fillConvexPoly(img, np.array([px(x, y) for x, y in rect_corners(r)], np.int32), (220, 120, 20))
    for objs, col in ((machines, (30, 130, 240)), (pillars, (200, 60, 150))):
        for o in objs:
            co, si = math.cos(o["rot"]), math.sin(o["rot"])
            pts = [px(o["x"] + u * co - v * si, o["y"] + u * si + v * co) for u, v in ((-o["w"] / 2, -o["d"] / 2), (o["w"] / 2, -o["d"] / 2), (o["w"] / 2, o["d"] / 2), (-o["w"] / 2, o["d"] / 2))]
            cv2.polylines(img, [np.array(pts, np.int32)], True, col, 2)
    # crop to what was found, with 2 m round it
    xs = [x for r in walls for x, _ in rect_corners(r)] + [o["x"] for o in machines + pillars]
    ys = [y for r in walls for _, y in rect_corners(r)] + [o["y"] for o in machines + pillars]
    if xs:
        (a0, b0), (a1, b1) = px(min(xs) - 2, max(ys) + 2), px(max(xs) + 2, min(ys) - 2)
        img = img[max(0, min(b0, b1)) : max(b0, b1), max(0, min(a0, a1)) : max(a0, a1)]
    img = img[::-1]  # y up
    cv2.imwrite(path, img)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("dxf")
    ap.add_argument("--preview", help="write a PNG: the point cloud with the result on top")
    ap.add_argument("--report", help="write the numbers as JSON")
    ap.add_argument("--orientation", choices=["auto", "x-y", "rows-y"], default="auto", help="how the grid is stored (default: from the robot's path)")
    ap.add_argument("--hit-low", type=int, default=6, help="weakest lidar level kept when it joins a strong one (0-20)")
    ap.add_argument("--hit-high", type=int, default=14, help="level that counts as a sure hit (0-20)")
    ap.add_argument("--hit-mid", type=int, default=9, help="second, weaker level objects are looked for at (0-20)")
    ap.add_argument("--min-wall", type=float, default=1.0, help="shortest straight run that is a wall, m")
    ap.add_argument("--support", type=float, default=2.0, help="a wall direction needs at least one wall this long, m")
    ap.add_argument("--bridge", type=float, default=0.5, help="gaps in a wall up to this are closed (window frames), m")
    ap.add_argument("--door", type=float, default=0.9, help="openings narrower than this do not join two rooms, m")
    ap.add_argument("--min-room", type=float, default=2.0, help="smallest room, m2")
    ap.add_argument("--min-object", type=float, default=0.12, help="smallest machine, m2")
    ap.add_argument("--min-pillar", type=float, default=0.08, help="smallest compact post or column, m2")
    ap.add_argument("--min-object-side", type=float, default=0.25, help="thinnest machine, m")
    ap.add_argument("--min-thin", type=float, default=0.4, help="thinnest machine longer than a pillar, m (a row of dots or a line is not a machine)")
    ap.add_argument("--max-object", type=float, default=15.0, help="longest machine, m")
    ap.add_argument("--min-strong", type=float, default=0.35, help="sure hits per outline cell a blob needs to be real")
    ap.add_argument("--min-hits", type=int, default=40, help="fewest sure hits a blob needs to be real")
    ap.add_argument("--pillar-max", type=float, default=0.9, help="a squarish blob up to this size is a pillar, m")
    ap.add_argument("--simplify", type=float, default=0.15, help="room outline simplification, m")
    ap.add_argument("--room-names", default="", help="comma separated names for the rooms, biggest first")
    ap.add_argument("--keep-outside", action="store_true", help="also keep structure outside the main building")
    opts = ap.parse_args()
    opts.room_names = [s.strip() for s in opts.room_names.split(",") if s.strip()]

    data = read_inputs(opts.source)
    grid, meta = data["grid"], data["meta"]
    res, origin = float(meta["grid_res"]), meta["map_origins"][0]
    log(f"grid {grid.shape}, {res * 100:.0f} cm cells, origin cell {origin}")
    f = 1
    while grid.size / (f * f) > 70_000_000:
        f *= 2
    if f > 1:
        log(f"large map: looked at {f}x coarser")
        grid = pool(grid, f)
        res *= f
        origin = [origin[0] / f, origin[1] / f]
    orient = opts.orientation if opts.orientation != "auto" else detect_orientation(grid, res, origin, data["poses"])
    log(f"orientation {orient}")
    F = Frame(grid, res, origin, orient)
    W = F.W
    notes = {}

    mask = occupancy_mask(W, opts.hit_low, opts.hit_high)
    strong = (W >= opts.hit_high).astype(np.uint8)
    log(f"hits: {int(mask.sum())} cells")
    interior, r_close = building(mask, res, notes)
    log(f"building found (outline closed with a {r_close} m closing), {interior.sum() * res * res:.0f} m2")
    dil = morph(interior.astype(np.uint8), cv2.MORPH_DILATE, disk(0.5 / res))
    ero = morph(interior.astype(np.uint8), cv2.MORPH_ERODE, disk(0.4 / res))
    ring = (dil - ero).clip(0, 1)
    scope = dil if not opts.keep_outside else np.ones_like(dil)
    cand = mask & scope
    notes["hits_outside_building"] = int(mask.sum() - cand.sum())

    dirs = wall_directions(cand, res)
    log("wall directions: " + ", ".join(f"{math.degrees(d):.1f} deg" for d in dirs))
    walls, union = extract_walls(F, cand, ring, dirs, opts, notes)
    log(f"{len(walls)} walls")
    walls_img = raster_rects(mask.shape, F, walls)
    machines, pillars = extract_objects(F, W, interior, walls_img, walls, dirs, opts, notes)
    log(f"{len(machines)} machines, {len(pillars)} pillars")
    rooms = extract_rooms(F, walls_img, interior, opts, notes)
    log(f"{len(rooms)} rooms")

    write_dxf(opts.dxf, data["name"], walls, machines, pillars, rooms, opts)
    report = dict(
        map=data["name"],
        walls=len(walls),
        wall_length_m=round(sum(w["length"] for w in walls), 1),
        wall_thickness_m=sorted({round(w["t"], 2) for w in walls}),
        machines=len(machines),
        pillars=len(pillars),
        rooms=[dict(name=(opts.room_names[i] if i < len(opts.room_names) else ("hall" if i == 0 else f"Room {i}")), area_m2=round(r["area"], 1)) for i, r in enumerate(rooms)],
        directions_deg=[round(math.degrees(d), 1) for d in dirs],
        notes=notes,
    )
    if opts.report:
        json.dump(report, open(opts.report, "w"), indent=2)
    if opts.preview:
        write_preview(opts.preview, F, mask, W, walls, machines, pillars, rooms)
    print(json.dumps(report, indent=2))
    log(f"wrote {opts.dxf}")


if __name__ == "__main__":
    main()
