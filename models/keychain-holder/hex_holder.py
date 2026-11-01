"""Honeycomb 1/2/3-key holder with a Jibbitz tab: the slim 'loop' holder (slim_holder.py) with hexagonal windows and a
flat tab that takes a Crocs Jibbitz-style charm.

Windows: pointy-top hexagons (CELL_R circumradius, so their upper edges lean 60° and print without support) cut through
the outer walls in two rows, offset like a honeycomb:
  - lower row (z LOW_Z) beside the switch's bottom housing, one per key on the long sides, centred between the crush
    ribs (at ±RIB_AT) so the ribs stay whole, and one on the end without the keyring ear;
  - upper row (z HIGH_Z) beside the switch's top housing, half a cell over, where the stem can be seen moving.
  A solid belt stays round the switch plate (z BELT) so the plate keeps its full grip on the walls, and a solid band
  stays at the rim and above the bed.
Jibbitz tab: a flat hexagon, TAB_T thick and flush with the bed, off the end opposite the keyring ear, with a JIB_HOLE
hole chamfered both sides. A Jibbitz charm pushes its button through from above: the face sits on top, the button
underneath. Hole sizes vary between charms, so jibbitz-fit-test.stl has three sizes to try first.

    python3 models/keychain-holder/hex_holder.py      # holder-N-hex.stl for 1-3 keys, jibbitz-fit-test.stl
"""
import math, os
import manifold3d as m3

from slim_holder import holder, save, text_section, PITCH, SLOT_W, SLOT_END, SLOT_R, WALL, CAVITY, RIB_AT, HERE

CELL_R, STRUT = 2.6, 1.25                 # hexagon circumradius (pointy-top: 5.2 tall, 4.5 wide); min. web between
LOW_Z, HIGH_Z = 4.9, 13.6                 # row centres: belt 7.5-11.0 round the plate, 1.8 mm rim, 2.3 mm above the bed
JIB_HOLE, JIB_RING, TAB_T, JIB_CHAMFER = 8.5, 2.4, 2.0, 0.4
# Jibbitz rail on a long side: a T-slot open at the bottom. The charm's button slides up the wide channel behind the face
# plate while its neck runs in the narrow slot; a small bump at the slot mouth clicks it in place. Estimates until
# measured: button ~11 mm, neck ~6.5-7 mm, neck length ~3 mm.
RAIL_BUTTON, RAIL_DEPTH, RAIL_NECK, RAIL_FACE, RAIL_SIDE, RAIL_TOP, RAIL_H = 11.6, 2.4, 7.0, 2.0, 1.6, 14.0, 17.0


def hexagon(r, flat_up=False):
    a0 = 0 if flat_up else 90
    return m3.CrossSection([[(r * math.cos(math.radians(a0 + 60 * k)), r * math.sin(math.radians(a0 + 60 * k))) for k in range(6)]])


def cell_x(y, z, x0, x1, both=True):
    """A window through a wall facing ±x: hexagon in (y, z), from |x| = x0 to x1 (on -x only unless both)."""
    prism = m3.Manifold.extrude(hexagon(CELL_R), x1 - x0).rotate((90, 0, 90))   # section (y, z), along +x
    prism = prism.translate((x0, y, z))
    return prism + prism.mirror((1, 0, 0)) if both else prism.mirror((1, 0, 0))


def cell_y(x, z, y0, y1):
    """A window through the end wall at y in [y0, y1] (y1 > y0): hexagon in (x, z)."""
    return m3.Manifold.extrude(hexagon(CELL_R), y1 - y0).rotate((90, 0, 0)).translate((x, y1, z))


def hex_holder(keys, rail=False):
    ow, ol = SLOT_W + 2 * WALL, keys * PITCH + SLOT_END + 2 * WALL
    centres = [(i - (keys - 1) / 2) * PITCH for i in range(keys)]
    out = holder(keys, 'loop')
    cuts = []
    # long sides: lower windows at each key, upper windows half a cell over (and between keys)
    for y in centres:
        cuts.append(cell_x(y, LOW_Z, CAVITY / 2 - 0.3, ow / 2 + 1, not rail))
    upper = sorted({round(y + d, 3) for y in centres for d in (-3.0, 3.0)} | {round((a + b) / 2, 3) for a, b in zip(centres, centres[1:])})
    for y in upper:
        cuts.append(cell_x(y, HIGH_Z, SLOT_W / 2 - 0.3, ow / 2 + 1, not rail))
    # ends: the -y end (Jibbitz side) gets a lower window, both ends get two upper ones; the +y end has the keyring ear low
    end_out = ol / 2 + 1
    cuts.append(cell_y(0, LOW_Z, -end_out, centres[0] - CAVITY / 2 + 0.3))
    for x in (-3.0, 3.0):
        cuts.append(cell_y(x, HIGH_Z, -end_out, -(ol / 2 - WALL - 0.3)))
        cuts.append(cell_y(x, HIGH_Z, ol / 2 - WALL - 0.3, end_out))
    out -= m3.Manifold.batch_boolean(cuts, m3.OpType.Add)
    if rail:
        for y in centres:
            out = jibbitz_rail(out, ow / 2, y)
        return out
    return out + jibbitz_tab(-ol / 2)


def jibbitz_rail(body, x0, y):
    """Add a T-slot rail on the +x wall at y: the wall stays whole, the rail stands RAIL_DEPTH + RAIL_FACE proud of it."""
    out_x = x0 + RAIL_DEPTH + RAIL_FACE
    boss = m3.Manifold.extrude(m3.CrossSection.square((out_x - x0 + 0.6, RAIL_BUTTON + 2 * RAIL_SIDE), center=True).offset(0.0, m3.JoinType.Round), RAIL_H)
    boss = boss.translate(((x0 - 0.6 + out_x) / 2, y, 0))
    roof = lambda w, xa, xb: m3.Manifold.batch_hull([
        m3.Manifold.cube((xb - xa, w, RAIL_TOP + 1)).translate((xa, y - w / 2, -1)),
        m3.Manifold.cube((xb - xa, 0.01, 0.01)).translate((xa, y - 0.005, RAIL_TOP + w / 2))])   # 45° top, no support
    body = body + boss
    body -= roof(RAIL_BUTTON, x0, x0 + RAIL_DEPTH)                         # channel for the button
    body -= roof(RAIL_NECK, x0 + RAIL_DEPTH - 0.01, out_x + 1)             # slot for the neck
    for side in (-1, 1):                                                   # click bumps at the slot mouth
        bump = m3.CrossSection([[(0, 0), (0.6, 0.3), (1.2, 0)]])           # in (z, inward)
        b = m3.Manifold.extrude(bump, RAIL_FACE).rotate((0, 90, 0)).rotate((0, 0, 0))
        bb = m3.Manifold.batch_hull([m3.Manifold.cube((RAIL_FACE, 0.3, 0.01)).translate((x0 + RAIL_DEPTH, 0, 1.4)),
                                     m3.Manifold.cube((RAIL_FACE, 0.01, 1.2)).translate((x0 + RAIL_DEPTH, 0, 0.8))])
        body += bb.translate((0, y + side * RAIL_NECK / 2 - (0.3 if side > 0 else 0), 0)) if side > 0 else bb.mirror((0, 1, 0)).translate((0, y - RAIL_NECK / 2 + 0.3, 0))
    return body


def jibbitz_tab(end_y):
    flat = JIB_HOLE + 2 * JIB_RING                 # across the flats
    cy = end_y - flat / 2 + 1.0                    # one flat overlaps the end wall by 1 mm
    plate = m3.Manifold.extrude(hexagon(flat / math.sqrt(3), flat_up=True), TAB_T).translate((0, cy, 0))
    r, c = JIB_HOLE / 2, JIB_CHAMFER
    hole = m3.Manifold.cylinder(TAB_T + 2, r, r, 96).translate((0, 0, -1))
    hole += m3.Manifold.cylinder(c + 0.01, r + c, r, 96).translate((0, 0, -0.01))             # bottom lead-in
    hole += m3.Manifold.cylinder(c + 0.01, r, r + c, 96).translate((0, 0, TAB_T - c))         # top lead-in
    return plate - hole.translate((0, cy, 0))


def fit_test(sizes=(8.0, 8.5, 9.0)):
    """A TAB_T plate with one hole per size, labelled, to find the hole that holds your charms."""
    gap = 16.0
    plate = m3.Manifold.extrude(m3.CrossSection.square((gap * len(sizes) + 4, 24), center=True).offset(2, m3.JoinType.Round, circular_segments=48), TAB_T)
    for i, d in enumerate(sizes):
        x = (i - (len(sizes) - 1) / 2) * gap
        r, c = d / 2, JIB_CHAMFER
        hole = m3.Manifold.cylinder(TAB_T + 2, r, r, 96).translate((0, 0, -1))
        hole += m3.Manifold.cylinder(c + 0.01, r + c, r, 96).translate((0, 0, -0.01))
        hole += m3.Manifold.cylinder(c + 0.01, r, r + c, 96).translate((0, 0, TAB_T - c))
        plate -= hole.translate((x, 3.0, 0))
        label = text_section('%.1f' % d, 3.2)
        plate -= m3.Manifold.extrude(label, 0.41).translate((x, -8.0, TAB_T - 0.4))
    return plate


if __name__ == '__main__':
    for keys in (1, 2, 3):
        save(hex_holder(keys), os.path.join(HERE, 'holder-%d-hex.stl' % keys))
    save(hex_holder(1, rail=True), os.path.join(HERE, 'holder-1-hex-rail.stl'))
    save(fit_test(), os.path.join(HERE, 'jibbitz-fit-test.stl'))
