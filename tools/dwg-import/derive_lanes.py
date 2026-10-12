#!/usr/bin/env python3
"""Derive the rule-aware nav graph (nav.json, schema 2) for a site.

  python -I derive_lanes.py <site.json> <import.config.yaml> <out nav.json> [--preview png] [--force]

Pipeline: free-space mask (equipment/walls/forbidden/outside-zones removed) -> skeleton (aisle centre-lines)
-> graph -> stations attached (on-lane or short spur) -> fleet assignment per map area -> paired one-way lanes
(one per direction, keep-right) -> traffic zones at junctions -> validation (every station reachable by every
fleet that owns it, lanes never enter forbidden zones). Exit code 1 on validation errors unless --force.
Everything driven by the YAML config (fleets, forbidden, lanes); output is the editable source of truth.
"""
import sys, json, math, re
from collections import defaultdict, deque
import numpy as np, yaml
from scipy import ndimage
from skimage.morphology import skeletonize

CELL = 0.25
ERR = []


def rect_m(cfg, r):  # DWG mm rect -> site meters
    ox, oy, sc = cfg["crop"][0], cfg["crop"][1], cfg["scale"]
    return [(r[0] - ox) * sc, (r[1] - oy) * sc, (r[2] - ox) * sc, (r[3] - oy) * sc]


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); d = b - a; L = np.hypot(*d) or 1e-9
    dist = [abs(d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0])) / L for p in pts[1:-1]]
    i = int(np.argmax(dist))
    if dist[i] > eps:
        return rdp(pts[:i + 2], eps)[:-1] + rdp(pts[i + 1:], eps)
    return [pts[0], pts[-1]]


def smooth(pts, eps=0.6, minseg=1.2):
    """Centre-line cleanup: coarse RDP, then drop interior points closer than minseg to the previous kept point."""
    p = rdp(pts, eps); out = [p[0]]
    for q in p[1:-1]:
        if math.hypot(q[0] - out[-1][0], q[1] - out[-1][1]) >= minseg: out.append(q)
    if len(out) > 1 and math.hypot(p[-1][0] - out[-1][0], p[-1][1] - out[-1][1]) < minseg * 0.5 and len(out) > 2: out.pop()
    out.append(p[-1]); return out


def plen(pts):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))


def offset_poly(pts, off):
    """Offset to the right of travel direction (keep-right traffic)."""
    n = len(pts); out = []
    nrm = []
    for a, b in zip(pts, pts[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1e-9; nrm.append((dy / L, -dx / L))
    for i, p in enumerate(pts):
        if i == 0: v = nrm[0]; k = 1.0
        elif i == n - 1: v = nrm[-1]; k = 1.0
        else:
            sx, sy = nrm[i - 1][0] + nrm[i][0], nrm[i - 1][1] + nrm[i][1]; m = math.hypot(sx, sy) or 1e-9
            v = (sx / m, sy / m); k = min(1.0 / max(v[0] * nrm[i][0] + v[1] * nrm[i][1], 0.5), 1.6)
        out.append([round(p[0] + v[0] * off * k, 2), round(p[1] + v[1] * off * k, 2)])
    # drop points that would make the lane run backwards (happens at sharp bends of short segments)
    dirs = [(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:])]
    clean = [out[0]]
    for i in range(1, n):
        d = dirs[min(i, n - 2) if i < n - 1 else n - 2]; v = (out[i][0] - clean[-1][0], out[i][1] - clean[-1][1])
        if v[0] * d[0] + v[1] * d[1] <= 1e-6:
            if i == n - 1 and len(clean) > 1: clean.pop(); clean.append(out[i])
            continue
        clean.append(out[i])
    if len(clean) < 2: clean = [out[0], out[-1]]
    return clean


def main():
    site = json.load(open(sys.argv[1])); cfg = yaml.safe_load(open(sys.argv[2])); out = sys.argv[3]
    L = cfg["lanes"]; clr = L["clearance"]; off = L["offset"]
    zones = [z for z in site["zones"] if z["active"]]
    zr = {z["id"]: (z["polygon"][0][0], z["polygon"][0][1], z["polygon"][2][0], z["polygon"][2][1]) for z in zones}
    zorder = {z["id"]: i for i, z in enumerate(site["zones"])}
    forb = [dict(f, rect=rect_m(cfg, f["rect"])) for f in cfg["forbidden"]]
    fleets = cfg["fleets"]; fa = {f["id"]: [zr[a] for a in f["areas"]] for f in fleets}
    inrect = lambda p, r, t=0.0: r[0] - t <= p[0] <= r[2] + t and r[1] - t <= p[1] <= r[3] + t
    in_fleet = lambda p, f, t=0.4: any(inrect(p, r, t) for r in fa[f])
    zone_of = lambda p: next((z["id"] for z in zones if inrect(p, zr[z["id"]])), None)

    # ---------- free-space mask
    x0 = min(r[0] for r in zr.values()); y0 = min(r[1] for r in zr.values()); x1 = max(r[2] for r in zr.values()); y1 = max(r[3] for r in zr.values())
    W, H = int((x1 - x0) / CELL) + 1, int((y1 - y0) / CELL) + 1
    occ = np.ones((H, W), bool)
    xs = x0 + (np.arange(W) + .5) * CELL; ys = y0 + (np.arange(H) + .5) * CELL
    for r in zr.values():
        occ[np.ix_((ys >= r[1]) & (ys <= r[3]), (xs >= r[0]) & (xs <= r[2]))] = False
    def fill(cx, cy, hw, hd):
        a, b = int((cx - hw - x0) / CELL), int((cx + hw - x0) / CELL); c, d = int((cy - hd - y0) / CELL), int((cy + hd - y0) / CELL)
        occ[max(c, 0):max(d + 1, 0), max(a, 0):max(b + 1, 0)] = True
    for q in site["equipment"]: fill(q["x"], q["y"], q["w"] / 2, q["d"] / 2)
    for w in site["walls"]:
        (ax, ay), (bx, by) = w["a"], w["b"]; n = max(2, int(math.hypot(bx - ax, by - ay) / CELL) + 1)
        for t in np.linspace(0, 1, n): fill(ax + (bx - ax) * t, ay + (by - ay) * t, w["t"] / 2, w["t"] / 2)
    for f in forb: r = f["rect"]; fill((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, (r[2] - r[0]) / 2 + 0.6, (r[3] - r[1]) / 2 + 0.6)
    clear = ndimage.distance_transform_edt(~occ) * CELL
    free = clear >= clr
    lab, n = ndimage.label(free, np.ones((3, 3)))
    free = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
    _, (iy_n, ix_n) = ndimage.distance_transform_edt(~free, return_indices=True)
    px = lambda iy, ix: (round(x0 + (ix + .5) * CELL, 3), round(y0 + (iy + .5) * CELL, 3))
    is_free = lambda p: (lambda ix, iy: 0 <= iy < H and 0 <= ix < W and free[iy, ix])(int((p[0] - x0) / CELL), int((p[1] - y0) / CELL))

    # ---------- skeleton -> graph
    skel = skeletonize(free)
    K = np.ones((3, 3), int); K[1, 1] = 0
    nb = ndimage.convolve(skel.astype(int), K, mode="constant") * skel
    nodes_mask = skel & (nb != 2)
    nlab, nn = ndimage.label(nodes_mask, np.ones((3, 3)))
    nodes = {}
    for i in range(1, nn + 1):
        yy, xx = np.nonzero(nlab == i); nodes[f"n{i}"] = list(px(yy.mean(), xx.mean()))
    clab, cn = ndimage.label(skel & ~nodes_mask, np.ones((3, 3)))
    edges = []
    objs = ndimage.find_objects(clab)
    for ci, sl in enumerate(objs, 1):
        sub = clab[sl] == ci; yy, xx = np.nonzero(sub); pix = {(y + sl[0].start, x + sl[1].start) for y, x in zip(yy, xx)}
        contacts = []
        for (y, x) in pix:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy2, xx2 = y + dy, x + dx
                    if (dy or dx) and 0 <= yy2 < H and 0 <= xx2 < W and nlab[yy2, xx2] > 0: contacts.append(((y, x), int(nlab[yy2, xx2])))
        if not contacts: continue
        start = contacts[0][0]; la = contacts[0][1]
        par = {start: None}; dq = deque([start]); last = start
        while dq:
            cur = dq.popleft(); last = cur
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nxt = (cur[0] + dy, cur[1] + dx)
                    if (dy or dx) and nxt in pix and nxt not in par: par[nxt] = cur; dq.append(nxt)
        path = []; c = last
        while c is not None: path.append(c); c = par[c]
        path.reverse()
        lb = next((l for p, l in contacts if p == last and l != la), None) or next((l for p, l in contacts if l != la), la)
        pts = [px(*c) for c in path]
        edges.append({"a": f"n{la}", "b": f"n{lb}", "pts": [nodes[f"n{la}"]] + [list(p) for p in pts] + [nodes[f"n{lb}"]], "spur": False})
    for e in edges: e["pts"] = rdp(e["pts"], 0.3)
    edges = [e for e in edges if not (e["a"] == e["b"] and plen(e["pts"]) < 4)]

    def degree():
        d = defaultdict(int)
        for e in edges: d[e["a"]] += 1; d[e["b"]] += 1
        return d
    for _ in range(6):                                   # prune short dead-end stubs
        d = degree(); keep = []
        for e in edges:
            if plen(e["pts"]) < 2.5 and (d[e["a"]] == 1 or d[e["b"]] == 1): continue
            keep.append(e)
        if len(keep) == len(edges): break
        edges = keep
    def merge_deg2():
        changed = True
        while changed:
            changed = False; d = degree(); inc = defaultdict(list)
            for i, e in enumerate(edges): inc[e["a"]].append(i); inc[e["b"]].append(i)
            for nid, ids in inc.items():
                if d[nid] == 2 and len(ids) == 2 and ids[0] != ids[1]:
                    e1, e2 = edges[ids[0]], edges[ids[1]]
                    if e1["spur"] or e2["spur"]: continue
                    p1 = e1["pts"] if e1["b"] == nid else e1["pts"][::-1]; a1 = e1["a"] if e1["b"] == nid else e1["b"]
                    p2 = e2["pts"] if e2["a"] == nid else e2["pts"][::-1]; b2 = e2["b"] if e2["a"] == nid else e2["a"]
                    edges[ids[0]] = {"a": a1, "b": b2, "pts": rdp(p1 + p2[1:], 0.3), "spur": False}; edges.pop(ids[1]); changed = True; break
    merge_deg2()
    for e in edges: e["pts"] = smooth(e["pts"])
    used = {e["a"] for e in edges} | {e["b"] for e in edges}; nodes = {k: v for k, v in nodes.items() if k in used}

    # ---------- stations
    reqs = []
    def title(t): return re.sub(r"\s+", " ", t).strip().title().replace("Asrs", "ASRS").replace("Smt", "SMT").replace("Wip", "WIP").replace("Tht", "THT").replace("Pcba", "PCBA").replace("Vstore", "VStore").replace("Hs ", "HS ")
    rules = [(r"VSTORE|ASRS", "asrs"), (r"PCBA WIP|THT WIP|HS WIP", "buffer"), (r"SMT\s*OVER", "pick"), (r"REPAIR", "drop"), (r"PREPARATION", "drop")]
    for lb in site["labels"]:
        for rx, typ in rules:
            if re.search(rx, lb["text"], re.I):
                p = (lb["x"], lb["y"])
                if zone_of(p) and not any(inrect(p, f["rect"]) for f in forb): reqs.append({"p": p, "type": typ, "name": title(lb["text"])})
                break
    def samples(step=1.0):
        out = []
        for ei, e in enumerate(edges):
            if e["spur"]: continue
            acc = 0.0
            for si, (a, b) in enumerate(zip(e["pts"], e["pts"][1:])):
                l = math.hypot(b[0] - a[0], b[1] - a[1]); t = 0.0
                while t < l: out.append((a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l, ei, si)); t += step
        return out
    def fps(cands, k, region=None, minsep=0.0):  # farthest point sampling
        cands = [c for c in cands if region is None or inrect(c, region)]
        if not cands: return []
        pick = [cands[len(cands) // 2]]
        while len(pick) < k:
            best, bd = None, -1
            for c in cands:
                d = min(math.hypot(c[0] - p[0], c[1] - p[1]) for p in pick)
                if d > bd: best, bd = c, d
            if bd < max(minsep, 3.0): break
            pick.append(best)
        return pick
    S0 = samples()
    if "assembly" in zr:
        for i, p in enumerate(fps(S0, 8, (zr["assembly"][0], zr["assembly"][1] + 2, zr["assembly"][2], zr["assembly"][3] - 2)), 1): reqs.append({"p": (p[0], p[1]), "type": "drop", "name": f"Assembly Workstation {i}"})
    if "east-strip" in zr:
        for i, p in enumerate(fps(S0, 3, (zr["east-strip"][0] + 1, zr["east-strip"][1] + 2, zr["east-strip"][2] - 1, zr["east-strip"][3] - 2), 12), 1): reqs.append({"p": (p[0], p[1]), "type": "charge", "name": f"Charging Dock {i}"})
    # parking spots (idle robots wait there) and extra chargers inside the fleets' own areas; asked for after the others so the existing stations keep their places
    def spots(zone, k, minsep=6.0):
        if zone not in zr: return []
        far = [c for c in S0 if all(math.hypot(c[0] - q["p"][0], c[1] - q["p"][1]) >= 6.0 for q in reqs)]
        return fps(far, k, (zr[zone][0] + 1, zr[zone][1] + 2, zr[zone][2] - 1, zr[zone][3] - 2), minsep)
    for zone, k in (("smt-lines", 2), ("assembly", 2), ("asrs-prep", 2), ("east-strip", 2)):
        for p in spots(zone, k): reqs.append({"p": (p[0], p[1]), "type": "park", "name": "Parking"})
    for zone in ("assembly", "asrs-prep"):
        for p in spots(zone, 1): reqs.append({"p": (p[0], p[1]), "type": "charge", "name": "Charging Dock"})
    stations = []; snodes = {}
    for q in reqs:
        S = samples(); iy, ix = iy_n[min(max(int((q["p"][1] - y0) / CELL), 0), H - 1), min(max(int((q["p"][0] - x0) / CELL), 0), W - 1)], ix_n[min(max(int((q["p"][1] - y0) / CELL), 0), H - 1), min(max(int((q["p"][0] - x0) / CELL), 0), W - 1)]
        tgt = px(iy, ix)
        S.sort(key=lambda s: math.hypot(s[0] - tgt[0], s[1] - tgt[1]))
        chosen = None
        for s in S[:60]:
            d = math.hypot(s[0] - tgt[0], s[1] - tgt[1])
            if d > L["spurMax"]: break
            if all(is_free((s[0] + (tgt[0] - s[0]) * t / 10, s[1] + (tgt[1] - s[1]) * t / 10)) for t in range(11)): chosen = (s, d); break
        if not chosen: ERR.append(f"station '{q['name']}' at {q['p']}: no free approach within spurMax"); continue
        (sx, sy, ei, si), d = chosen
        e = edges[ei]; J = f"j{len(nodes)}"; nodes[J] = [round(sx, 2), round(sy, 2)]
        e1 = {"a": e["a"], "b": J, "pts": e["pts"][:si + 1] + [[round(sx, 2), round(sy, 2)]], "spur": False}
        e2 = {"a": J, "b": e["b"], "pts": [[round(sx, 2), round(sy, 2)]] + e["pts"][si + 1:], "spur": False}
        edges[ei] = e1; edges.append(e2)
        if d <= 0.9: snode = J
        else:
            snode = f"s{len(nodes)}"; nodes[snode] = [round(tgt[0], 2), round(tgt[1], 2)]
            edges.append({"a": J, "b": snode, "pts": [nodes[J], nodes[snode]], "spur": True})
        stations.append({"nodeId": snode, "type": q["type"], "name": q["name"], "p": nodes[snode]})
    edges = [e for e in edges if plen(e["pts"]) > 0.05 or e["a"] != e["b"]]

    # ---------- fleet assignment, lanes
    def edge_fleets(e):
        pts = []
        for a, b in zip(e["pts"], e["pts"][1:]):
            l = math.hypot(b[0] - a[0], b[1] - a[1]); k = max(1, int(l))
            pts += [(a[0] + (b[0] - a[0]) * t / k, a[1] + (b[1] - a[1]) * t / k) for t in range(k + 1)]
        return [f["id"] for f in fleets if all(in_fleet(p, f["id"]) for p in pts)]
    lanes, eid = [], 0
    for e in edges:
        fl = edge_fleets(e); e["fleets"] = fl
        if not fl: continue
        for (a, b, pts) in ((e["a"], e["b"], e["pts"]), (e["b"], e["a"], e["pts"][::-1])):
            eid += 1; g = offset_poly(pts, off)
            lanes.append({"id": f"L{eid}", "from": a, "to": b, "geom": g, "fleets": fl, "speed": 1.2, "len": round(plen(g), 2), "spur": e["spur"]})
    # ---------- forbidden check + connectivity validation
    for ln in lanes:
        for p in ln["geom"]:
            for f in forb:
                if inrect(p, f["rect"]): ERR.append(f"lane {ln['id']} enters forbidden zone {f['id']}")
    for f in fleets:
        uf = {}
        def find(a):
            while uf.setdefault(a, a) != a: uf[a] = uf[uf[a]]; a = uf[a]
            return a
        for ln in lanes:
            if f["id"] in ln["fleets"]: uf[find(ln["from"])] = find(ln["to"])
        own = [s for s in stations if in_fleet(s["p"], f["id"])]
        if not own: continue
        cnt = defaultdict(int)
        for s in own: cnt[find(s["nodeId"])] += 1
        main = max(cnt, key=cnt.get)
        for s in own:
            if find(s["nodeId"]) != main: ERR.append(f"fleet {f['id']}: station '{s['name']}' unreachable (disconnected lane network)")
    # ---------- station ids (STA-101..)
    stations.sort(key=lambda s: (zorder.get(zone_of(s["p"]) or "", 99), -round(s["p"][1] / 4), s["p"][0]))
    n_id = defaultdict(int)       # stations STA-101.., parking spots PARK001.., chargers CHARGE001.. (parking and charging are named by their id)
    for s in stations:
        prefix = {"park": "PARK", "charge": "CHARGE"}.get(s["type"])
        n_id[prefix] += 1
        if prefix: s["id"] = s["name"] = f"{prefix}-{n_id[prefix]:03d}"
        else: s["id"] = f"STA-{100 + n_id[prefix]}"
    cnt_names = defaultdict(int); tot_names = defaultdict(int)
    for s in stations: tot_names[s["name"]] += 1
    for s in stations:
        if tot_names[s["name"]] > 1: cnt_names[s["name"]] += 1; s["name"] = f'{s["name"]} {cnt_names[s["name"]]}'
    snode_ids = {s["nodeId"] for s in stations}
    # ---------- traffic zones at junctions
    inc = defaultdict(list)
    for ln in lanes:
        inc[ln["from"]].append(ln)
    cand = []
    for nid, ls in inc.items():
        nbrs = {l["to"] for l in ls}
        if len(nbrs) >= 3 and nid not in snode_ids: cand.append((nodes[nid][0], nodes[nid][1], nid))
    S = L["traffic"]["size"]; tz = []
    def ok(c):
        sq = (c[0] - S / 2 - 0.5, c[1] - S / 2 - 0.5, c[0] + S / 2 + 0.5, c[1] + S / 2 + 0.5)
        if any(not (sq[2] < f["rect"][0] or sq[0] > f["rect"][2] or sq[3] < f["rect"][1] or sq[1] > f["rect"][3]) for f in forb): return False
        return not any(inrect(s["p"], sq) for s in stations)
    cand = [c for c in cand if ok(c)]
    shared = [z for z in zr if sum(z in f["areas"] for f in fleets) > 1]
    picked = []
    for r in [zr[z] for z in shared]: picked += fps(cand, 2, r, L["traffic"]["minSeparation"])
    for c in fps(cand, L["traffic"]["count"], None, L["traffic"]["minSeparation"]):
        if all(math.hypot(c[0] - p[0], c[1] - p[1]) >= L["traffic"]["minSeparation"] for p in picked): picked.append(c)
    for i, c in enumerate(picked[:L["traffic"]["count"] + 2], 1):
        fl = sorted({f for l in inc[c[2]] for f in l["fleets"]})
        tz.append({"id": f"TZ-{i:02d}", "name": f"Traffic Zone {i}", "capacity": 1, "fleets": fl, "polygon": [[round(c[0] - S / 2, 2), round(c[1] - S / 2, 2)], [round(c[0] + S / 2, 2), round(c[1] - S / 2, 2)], [round(c[0] + S / 2, 2), round(c[1] + S / 2, 2)], [round(c[0] - S / 2, 2), round(c[1] + S / 2, 2)]]})
    # ---------- write
    used = {l["from"] for l in lanes} | {l["to"] for l in lanes}
    nlist = [{"id": k, "x": round(v[0], 2), "y": round(v[1], 2), "kind": "station" if k in snode_ids else "waypoint"} for k, v in nodes.items() if k in used]
    stn = []
    for s in stations:
        if s["nodeId"] not in used: ERR.append(f"station {s['name']} has no lanes"); continue
        z = zone_of(s["p"])
        stn.append({"id": s["id"], "name": s["name"], "nodeId": s["nodeId"], "type": s["type"], "zone": z, "fleets": [f["id"] for f in fleets if z in f["areas"]]})
    nav = {"schema": 2, "siteId": site["siteId"], "nodes": nlist, "lanes": [{k: v for k, v in l.items() if k != "spur"} for l in lanes], "stations": stn,
           "fleets": [{"id": f["id"], "name": f["name"], "color": f["color"], "areas": f["areas"]} for f in fleets],
           "trafficZones": tz, "forbiddenZones": [{"id": f["id"], "name": f["name"], "reason": f.get("reason", ""), "polygon": [[f["rect"][0], f["rect"][1]], [f["rect"][2], f["rect"][1]], [f["rect"][2], f["rect"][3]], [f["rect"][0], f["rect"][3]]]} for f in forb]}
    json.dump(nav, open(out, "w"), separators=(",", ":"))
    print(f"nodes={len(nlist)} lanes={len(lanes)} stations={len(stn)} trafficZones={len(tz)} forbidden={len(forb)} sizeKB={len(json.dumps(nav)) // 1024}")
    for e in ERR: print("ERROR:", e)
    if "--preview" in sys.argv:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        from matplotlib.patches import Rectangle, Polygon
        fig, ax = plt.subplots(figsize=(9, 16), dpi=90)
        for q in site["equipment"]: ax.add_patch(Rectangle((q["x"] - q["w"] / 2, q["y"] - q["d"] / 2), q["w"], q["d"], fc="#d9dfdc", ec="none"))
        col = {"line-side": "#14b8a6", "asrs": "#f59e0b"}
        for l in lanes:
            c = "#8b5cf6" if len(l["fleets"]) > 1 else col.get(l["fleets"][0], "k"); g = np.array(l["geom"]); ax.plot(g[:, 0], g[:, 1], c=c, lw=.8)
        for z in tz: ax.add_patch(Polygon(z["polygon"], fc="#f59e0b", alpha=.4, ec="#b45309"))
        for f in nav["forbiddenZones"]: ax.add_patch(Polygon(f["polygon"], fc="#ef4444", alpha=.4, ec="#b91c1c"))
        ax.scatter([s["p"][0] for s in stations], [s["p"][1] for s in stations], c="k", s=14, zorder=5)
        for s in stations: ax.text(s["p"][0] + .5, s["p"][1], s["id"][-3:], fontsize=5)
        for r in zr.values(): ax.add_patch(Rectangle((r[0], r[1]), r[2] - r[0], r[3] - r[1], fc="none", ec="#999", lw=.6))
        ax.set_xlim(x0 - 2, x1 + 2); ax.set_ylim(y0 - 2, y1 + 2); ax.set_aspect("equal"); fig.savefig(sys.argv[sys.argv.index("--preview") + 1], bbox_inches="tight")
    if ERR and "--force" not in sys.argv: sys.exit(1)


if __name__ == "__main__":
    main()
