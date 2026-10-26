"""Slim 1/2/3-key keychain holder: the tuned holder's fit, rebuilt clean with even 1.6 mm walls and a big keyring hole.

Same fit as holder-N.stl (tune_holder.py): a 17.65 mm slot (corner R 2.2, 17.5 mm key pitch) that wraps the 17 mm
keycaps from the switch ledge at 10 mm up to an 18 mm rim, and a 14.0 x 14.0 mm MX switch tube down to a 1.26 mm floor.
What changes:
  - walls an even WALL mm all round (the supplied body had 1.75 mm on two sides and 2.5-2.65 mm on the others, where
    a 3 mm keyring tunnel ran diagonally through the corner): 20.85 mm wide instead of 22, and 1.4 mm shorter per end;
  - the keyring goes through a flat tab off one bottom corner, flush with the bed, with a HOLE mm hole: a split ring
    threads straight through instead of round a bend;
  - a 0.4 mm chamfer on the bottom edge (first-layer squish) and a 0.3 mm lead-in at the slot's top edge.
Prints as is, floor on the bed, no supports.

    python3 models/keychain-holder/slim_holder.py        # holder-1-slim.stl, holder-2-slim.stl, holder-3-slim.stl
"""
import math, os
import numpy as np
import manifold3d as m3
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
PITCH, SLOT_W, SLOT_END, SLOT_R = 17.5, 17.65, 0.15, 2.2   # slot length = keys x pitch + SLOT_END
TUBE, FLOOR, LEDGE, TOP = 14.0, 1.26, 10.0, 18.0
WALL, FOOT, LEAD = 1.6, 0.4, 0.3
HOLE, TAB_RING, TAB_T, TAB_OUT = 5.0, 2.0, 3.0, 4.2         # keyring hole; ring of material round it; tab thickness; reach


def rounded(w, h, r):
    return m3.CrossSection.square((w - 2 * r, h - 2 * r), center=True).offset(r, m3.JoinType.Round, circular_segments=64)


def holder(keys):
    sw, sl = SLOT_W, keys * PITCH + SLOT_END
    ow, ol, orr = sw + 2 * WALL, sl + 2 * WALL, SLOT_R + WALL
    slab = lambda sec, z0, z1: m3.Manifold.extrude(sec, z1 - z0).translate((0, 0, z0))
    body = m3.Manifold.batch_hull([slab(rounded(ow - 2 * FOOT, ol - 2 * FOOT, orr - FOOT), 0, 0.01), slab(rounded(ow, ol, orr), FOOT, TOP)])
    # keyring tab off the (-x, +y) corner: a hull of the body's corner circle and a ring round the hole
    cx, cy = -(ow / 2 - orr), ol / 2 - orr; d = (orr + TAB_OUT) / math.sqrt(2); hx, hy = cx - d, cy + d
    ring = HOLE / 2 + TAB_RING
    tab = m3.CrossSection.batch_hull([m3.CrossSection.circle(orr, 64).translate((cx, cy)), m3.CrossSection.circle(ring, 64).translate((hx, hy))])
    tab = slab(tab, 0, TAB_T) - slab(m3.CrossSection.circle(HOLE / 2, 64).translate((hx, hy)), -1, TAB_T + 1)
    out = body + tab
    out -= slab(rounded(sw, sl, SLOT_R), LEDGE, TOP + 1)
    out -= m3.Manifold.batch_hull([slab(rounded(sw, sl, SLOT_R), TOP - LEAD, TOP - LEAD + 0.01), slab(rounded(sw + 2 * LEAD, sl + 2 * LEAD, SLOT_R + LEAD), TOP, TOP + 0.01)])
    for i in range(keys):
        y = (i - (keys - 1) / 2) * PITCH
        out -= slab(m3.CrossSection.square((TUBE, TUBE), center=True), FLOOR, LEDGE + 0.5).translate((0, y, 0))
    return out


def save(man, path):
    g = man.to_mesh(); t = trimesh.Trimesh(np.asarray(g.vert_properties)[:, :3], np.asarray(g.tri_verts), process=True); t.export(path)
    print(os.path.basename(path), 'watertight', t.is_watertight, 'volume %.0f' % t.volume, 'size', np.round(t.extents, 2).tolist())


if __name__ == '__main__':
    for keys in (1, 2, 3):
        save(holder(keys), os.path.join(HERE, 'holder-%d-slim.stl' % keys))
