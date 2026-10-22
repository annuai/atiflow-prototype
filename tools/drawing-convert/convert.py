#!/usr/bin/env python3
"""DWG -> DXF for the Map Editor's drawing import (Structure > Drawing > Import drawing).

A browser cannot read DWG, so this runs once on a terminal (later it can sit behind a server):

  python -I tools/drawing-convert/convert.py <in.dwg|in.dxf> <out.dxf> [options]

  --list                 print what is in the drawing (layers, blocks, extent) and stop
  --crop X0,Y0,X1,Y1     keep only what lies inside this box (drawing units, e.g. millimetres):
                         a plant drawing holds several buildings, a map covers one
  --drop-layers A,B,...  remove these layers
  --drop-noise           also remove the layers every plan has and no 3D map needs (dimensions,
                         notes, hatches, title blocks, MEP: the same words the importer ignores)

Needs libredwg (`brew install libredwg`, gives dwg2dxf) for DWG input and `pip install -r
tools/dwg-import/requirements.txt` (ezdxf). The DXF it writes opens in the app as it is.
Entities are kept or dropped whole: nothing is changed, moved or redrawn.
"""
import argparse, os, re, shutil, subprocess, sys, tempfile, collections

NOISE = re.compile(
    r"(^|[^a-z])(dim|dimension|text|note|annot|anno|title|tblock|border|frame|hatch|grid|axis|"
    r"defpoints|viewport|vport|symbol|elev|ceil|light|lamp|power|elec|lan|network|data|pipe|pvc|duct|"
    r"conduit|cable|hvac|fire|sprink|mep|plumb|sanit|iso|sichtbar|xref|revision|cloud|leader|arrow|"
    r"north|scale|legend|logo|furn|chair|desk|tree|plant|landscape|topo|contour|layer01)",
    re.I,
)


def to_dxf(src, tmp):
    if src.lower().endswith(".dxf"):
        return src
    exe = shutil.which("dwg2dxf")
    if not exe:
        sys.exit("dwg2dxf not found: install libredwg (brew install libredwg)")
    out = os.path.join(tmp, "converted.dxf")
    # the warnings about DIMASSOC / BLOCKREPRESENTATION data are harmless
    subprocess.run([exe, "-y", "-o", out, src], check=True, stderr=subprocess.DEVNULL)
    return out


def bbox_of(e):
    """Rough (minx, miny, maxx, maxy) of an entity from its defining points, or None."""
    t = e.dxftype()
    try:
        if t == "LINE":
            s, f = e.dxf.start, e.dxf.end
            return min(s.x, f.x), min(s.y, f.y), max(s.x, f.x), max(s.y, f.y)
        if t == "LWPOLYLINE":
            p = [(x, y) for x, y, *_ in e.get_points()]
        elif t in ("CIRCLE", "ARC"):
            c, r = e.dxf.center, e.dxf.radius
            return c.x - r, c.y - r, c.x + r, c.y + r
        elif t in ("INSERT", "TEXT", "MTEXT", "POINT"):
            q = e.dxf.insert if t != "POINT" else e.dxf.location
            return q.x, q.y, q.x, q.y
        elif t == "POLYLINE":
            p = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        elif t == "SPLINE":
            p = [(v[0], v[1]) for v in e.control_points]
        else:
            return None
        if not p:
            return None
        xs, ys = [a for a, _ in p], [b for _, b in p]
        return min(xs), min(ys), max(xs), max(ys)
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--crop")
    ap.add_argument("--drop-layers", default="")
    ap.add_argument("--drop-noise", action="store_true")
    a = ap.parse_args()
    if not a.list and not a.dst:
        ap.error("an output file is needed (or --list)")
    import ezdxf
    from ezdxf import recover

    with tempfile.TemporaryDirectory() as tmp:
        dxf = to_dxf(a.src, tmp)
        doc, auditor = recover.readfile(dxf)
        if auditor.has_errors:
            print(f"note: {len(auditor.errors)} problems in the file were repaired or skipped", file=sys.stderr)
        msp = doc.modelspace()
        if a.list:
            layers = collections.Counter(e.dxf.layer for e in msp)
            blocks = collections.Counter(e.dxf.name for e in msp if e.dxftype() == "INSERT")
            print("units ($INSUNITS):", doc.header.get("$INSUNITS", 0))
            print("layers:")
            for k, n in layers.most_common(40):
                print(f"  {n:8d}  {k}")
            print("blocks placed:")
            for k, n in blocks.most_common(40):
                print(f"  {n:8d}  {k}")
            return
        crop = [float(v) for v in a.crop.split(",")] if a.crop else None
        drop = {s.strip() for s in a.drop_layers.split(",") if s.strip()}
        if a.drop_noise:
            drop |= {l.dxf.name for l in doc.layers if NOISE.search(l.dxf.name)}
        removed = kept = 0
        for e in list(msp):
            gone = e.dxf.layer in drop
            if not gone and crop:
                b = bbox_of(e)
                gone = b is not None and (b[2] < crop[0] or b[0] > crop[2] or b[3] < crop[1] or b[1] > crop[3])
            if gone:
                msp.delete_entity(e)
                removed += 1
            else:
                kept += 1
        # blocks nobody places any more are dropped, so the file shrinks
        used = {e.dxf.name for e in msp if e.dxftype() == "INSERT"}
        changed = True
        while changed:
            changed = False
            for blk in list(doc.blocks):
                if blk.name.startswith("*") or blk.name in used:
                    continue
                try:
                    doc.blocks.delete_block(blk.name, safe=False)
                except Exception:
                    continue  # a block a dimension style still names stays
                changed = True
            used = {e.dxf.name for blk in doc.blocks for e in blk if e.dxftype() == "INSERT"} | {
                e.dxf.name for e in msp if e.dxftype() == "INSERT"
            }
        # dimension styles may name arrowhead blocks the file does not hold (or that were dropped above);
        # dimensions are not used by the import, so those names are cleared rather than failing the save
        for ds in doc.dimstyles:
            for attr in ("dimblk", "dimblk1", "dimblk2", "dimldrblk", "dimblk_handle", "dimblk1_handle", "dimblk2_handle", "dimldrblk_handle"):
                try:
                    ds.dxf.discard(attr)
                except Exception:
                    pass
        doc.saveas(a.dst)
        print(f"kept {kept} entities, removed {removed}; wrote {a.dst} ({os.path.getsize(a.dst) // 1024} KB)")


if __name__ == "__main__":
    main()
