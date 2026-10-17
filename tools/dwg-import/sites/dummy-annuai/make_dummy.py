#!/usr/bin/env python3
"""Makes a DUMMY architect's drawing (dummy.dxf) of the building in the sample lidar map (test_annuai), to try the DWG overlay with.

  python make_dummy.py <out.dxf>

The building is drawn the way a CAD drawing would be: millimetres, far from (0, 0) (the sheet origin is arbitrary), walls on WALL, columns on COLUMN, machines on EQUIP, and noise that
the importer must ignore (dimensions, a title block). Sizes follow the lidar map but the drawing is NOT a copy of it: it is clean and has a few walls the lidar never saw.
"""
import sys
import ezdxf

OX, OY = 530_000, 210_000  # where the drawing's (0, 0) is on the sheet, mm: the lidar frame is shifted by this
mm = lambda x, y: (OX + x * 1000, OY + y * 1000)

doc = ezdxf.new("R2018", setup=True)
doc.units = ezdxf.units.MM
for name, color in [("WALL", 7), ("COLUMN", 3), ("EQUIP", 5), ("DIM", 2), ("TITLEBLOCK", 8), ("TEXT", 2)]:
    doc.layers.add(name, color=color)
ms = doc.modelspace()

# outer walls: the building outline of the lidar map (the bottom wall is not square to the others)
ms.add_lwpolyline([mm(-16, 15.6), mm(24, 15.6), mm(24, -12.1), mm(-16, -9.0)], close=True, dxfattribs={"layer": "WALL"})
# inner walls
for (ax, ay), (bx, by) in [
    ((3.8, 12.7), (15.8, 12.7)),
    ((-5.8, 6.9), (-5.8, 15.6)),
    ((5.2, 9.6), (9.5, 9.6)),
    ((16.0, 8.3), (16.0, 12.7)),
    ((8.2, 5.5), (11.6, 5.5)),
    ((-16.0, 1.0), (-9.0, 1.0)),  # a small room on the west side that the lidar did not see
    ((-9.0, 1.0), (-9.0, -9.6)),
]:
    ms.add_line(mm(ax, ay), mm(bx, by), dxfattribs={"layer": "WALL"})
# columns (0.4 m squares on an 8 m grid)
for cx in (-12, -4, 4, 12, 20):
    for cy in (-6, 2, 10):
        h = 0.2
        ms.add_lwpolyline([mm(cx - h, cy - h), mm(cx + h, cy - h), mm(cx + h, cy + h), mm(cx - h, cy + h)], close=True, dxfattribs={"layer": "COLUMN"})
# machines
for cx, cy, w, d in [(0, -3, 3.0, 1.2), (12, -3, 2.4, 1.2), (-12, 8, 2.0, 2.0)]:
    ms.add_lwpolyline([mm(cx - w / 2, cy - d / 2), mm(cx + w / 2, cy - d / 2), mm(cx + w / 2, cy + d / 2), mm(cx - w / 2, cy + d / 2)], close=True, dxfattribs={"layer": "EQUIP"})
# noise the importer must ignore
ms.add_text("DUMMY BUILDING - NOT FOR CONSTRUCTION", dxfattribs={"layer": "TEXT", "height": 600, "insert": mm(-16, 17.5)})
ms.add_line(mm(-16, 16.4), mm(24, 16.4), dxfattribs={"layer": "DIM"})
ms.add_lwpolyline([mm(-20, 19), mm(28, 19), mm(28, -16), mm(-20, -16)], close=True, dxfattribs={"layer": "TITLEBLOCK"})
doc.saveas(sys.argv[1])
print("wrote", sys.argv[1])
