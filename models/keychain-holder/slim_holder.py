"""Slim 1/2/3-key keychain holder: the tuned holder's fit, rebuilt clean with even 1.6 mm walls and a big keyring hole.

Same fit as holder-N.stl (tune_holder.py): a 17.65 mm slot (corner R 2.2, 17.5 mm key pitch) that wraps the 17 mm
keycaps from the switch ledge at 10 mm up to an 18 mm rim, and a 14.0 x 14.0 mm MX switch tube down to a 1.26 mm floor.
What changes:
  - walls an even WALL mm all round (the supplied body had 1.75 mm on two sides and 2.5-2.65 mm on the others, where
    a 3 mm keyring tunnel ran diagonally through the corner): 20.85 mm wide instead of 22, and 1.4 mm shorter per end;
  - the keyring goes through a straight HOLE mm hole instead of round a bend, in one of three LOOP styles:
      'corner': a flat tab off one bottom corner, flush with the bed;
      'tab':    a smaller flat tab straight off the middle of one short end, flush with the bed;
      'loop':   a slim D-shaped ear on the middle of one short end, standing on the bed, its hole running across
                (parallel to the end and the bed) with a 45° pointed top so it prints without support;
  - a 0.4 mm chamfer on the bottom edge (first-layer squish) and a 0.3 mm lead-in at the slot's top edge.
Prints as is, floor on the bed, no supports.

    python3 models/keychain-holder/slim_holder.py        # holder-N-slim.stl (corner), -tab.stl, -loop.stl for 1-3 keys
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
END_HOLE, END_RING, END_T = 4.5, 1.6, 2.4                    # 'tab': hole, ring, thickness
LOOP_HOLE, LOOP_RING, LOOP_W = 4.0, 1.6, 4.0                 # 'loop': hole, ring, width along the end


def rounded(w, h, r):
    return m3.CrossSection.square((w - 2 * r, h - 2 * r), center=True).offset(r, m3.JoinType.Round, circular_segments=64)


def holder(keys, loop='corner'):
    sw, sl = SLOT_W, keys * PITCH + SLOT_END
    ow, ol, orr = sw + 2 * WALL, sl + 2 * WALL, SLOT_R + WALL
    slab = lambda sec, z0, z1: m3.Manifold.extrude(sec, z1 - z0).translate((0, 0, z0))
    body = m3.Manifold.batch_hull([slab(rounded(ow - 2 * FOOT, ol - 2 * FOOT, orr - FOOT), 0, 0.01), slab(rounded(ow, ol, orr), FOOT, TOP)])
    if loop == 'corner':   # flat tab off the (-x, +y) corner: a hull of the body's corner circle and a ring round the hole
        cx, cy = -(ow / 2 - orr), ol / 2 - orr; d = (orr + TAB_OUT) / math.sqrt(2); hx, hy = cx - d, cy + d
        tab = m3.CrossSection.batch_hull([m3.CrossSection.circle(orr, 64).translate((cx, cy)), m3.CrossSection.circle(HOLE / 2 + TAB_RING, 64).translate((hx, hy))])
        extra = slab(tab, 0, TAB_T) - slab(m3.CrossSection.circle(HOLE / 2, 64).translate((hx, hy)), -1, TAB_T + 1)
    elif loop == 'tab':    # small flat tab straight off the middle of the +y end
        ring = END_HOLE / 2 + END_RING; hy = ol / 2 + END_HOLE / 2 + 0.6
        tab = m3.CrossSection.batch_hull([m3.CrossSection.square((2 * ring, 0.01), center=True).translate((0, ol / 2 - 1)), m3.CrossSection.circle(ring, 64).translate((0, hy))])
        extra = slab(tab, 0, END_T) - slab(m3.CrossSection.circle(END_HOLE / 2, 64).translate((0, hy)), -1, END_T + 1)
    else:                  # D-shaped ear on the middle of the +y end, drawn in (y, z): flat on the bed, round outside
        ring = LOOP_HOLE / 2 + LOOP_RING; hy, hz = ol / 2 + LOOP_HOLE / 2 + 0.4, ring
        arch = m3.CrossSection.batch_hull([m3.CrossSection.square((1.0, 2 * ring), center=False).translate((ol / 2 - 1, 0)),
                                           m3.CrossSection.circle(ring, 64).translate((hy, hz)), m3.CrossSection.square((0.01, 0.01)).translate((hy, 0))])
        r = LOOP_HOLE / 2   # teardrop hole: a circle with a 45° point on top
        hole = m3.CrossSection.batch_hull([m3.CrossSection.circle(r, 64), m3.CrossSection.square((0.01, 0.01), center=True).translate((0, r * math.sqrt(2)))]).translate((hy, hz))
        arch = arch - hole
        # drawn in (y, z), extruded along x, then turned so the section's first axis is y and second is z
        extra = m3.Manifold.extrude(arch, LOOP_W).translate((0, 0, -LOOP_W / 2)).rotate((90, 0, 90))
    out = body + extra
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
        for loop, suffix in (('corner', ''), ('tab', '-tab'), ('loop', '-loop')):
            save(holder(keys, loop), os.path.join(HERE, 'holder-%d-slim%s.stl' % (keys, suffix)))
