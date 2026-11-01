"""Craft variants of the slim holder: yarn wrapping and LEGO-compatible studs (prototypes).

lego-stud-test.stl  An upright test wall (printed standing, like a holder's side) with 2x2 studs at three diameters,
                    plain on top, flat-bottomed below: the stud's lowest STUD_FLAT mm is cut off so the sideways
                    cylinder's underside does not sag. LEGO grips a stud round its sides, so the flat costs little grip.
holder-1-yarn.stl   The slim holder with its keyring tab on a bottom corner and a YARN_D deep band round the lower body
                    (YARN_Z) to wrap yarn or embroidery thread in, its top edge sloped 45° so it prints without support.
                    A TIE_HOLE hole in the corner tab ties the yarn's start; the end tucks under the wraps.
holder-1-combo.stl  The yarn band below, and two studs on each long side of the upper wall (where the keycap sits).

    python3 models/keychain-holder/craft_holder.py
"""
import math, os
import manifold3d as m3

from slim_holder import holder, save, text_section, PITCH, SLOT_W, SLOT_END, SLOT_R, WALL, HERE, TOP

STUD_D, STUD_H, STUD_PITCH, STUD_FLAT = 4.8, 1.7, 8.0, 0.25
YARN_Z, YARN_D, TIE_HOLE = (2.6, 7.6), 0.8, 2.0


def rounded(w, h, r):
    return m3.CrossSection.square((w - 2 * r, h - 2 * r), center=True).offset(r, m3.JoinType.Round, circular_segments=64)


def stud(d=STUD_D, flat=STUD_FLAT):
    """A stud standing out along -y from y = 0, centred on x = z = 0, its underside cut flat by `flat`."""
    s = m3.Manifold.cylinder(STUD_H + 0.3, d / 2, d / 2, 64).rotate((90, 0, 0)).translate((0, 0.3, 0))   # 0.3 into the wall
    if flat:
        s -= m3.Manifold.cube((d + 2, STUD_H + 2, d)).translate((-d / 2 - 1, -STUD_H - 1, -d / 2 - d + flat))
    return s


def stud_test():
    sizes, cols = (4.7, 4.8, 4.9), 3
    w, h, t = cols * 20, 44.0, 3.0
    wall = m3.Manifold.cube((w, t, h)).translate((-w / 2, 0, 0))
    foot = m3.Manifold.cube((w, 12.0, 2.0)).translate((-w / 2, -6.0 + t / 2, 0))   # keeps it standing on the bed
    out = wall + foot
    for i, d in enumerate(sizes):
        x0 = (i - 1) * 20
        for row, flat in ((0, 0.0), (1, STUD_FLAT)):            # upper group plain, lower group flat-bottomed
            zc = 32.0 if row == 0 else 16.0
            for dx in (-STUD_PITCH / 2, STUD_PITCH / 2):
                for dz in (-STUD_PITCH / 2, STUD_PITCH / 2):
                    out += stud(d, flat).translate((x0 + dx, 0, zc + dz))
        label = text_section('%.1f' % d, 3.0)
        out -= m3.Manifold.extrude(label, 0.41).rotate((90, 0, 0)).translate((x0, 0.4, 40.0))   # on the stud face, readable from the front
    return out


def yarn_band(body, ow, ol, orr):
    """Cut a YARN_D deep band round the outside between YARN_Z, its top sloped 45° (no support)."""
    z0, z1 = YARN_Z
    outer = rounded(ow + 2, ol + 2, orr + 1)
    inner = rounded(ow - 2 * YARN_D, ol - 2 * YARN_D, orr - YARN_D)
    ring = lambda sec_in, za, zb: m3.Manifold.extrude(outer, zb - za).translate((0, 0, za)) - m3.Manifold.extrude(sec_in, zb - za + 0.02).translate((0, 0, za - 0.01))
    band = ring(inner, z0, z1)
    slope = m3.Manifold.batch_hull([m3.Manifold.extrude(inner, 0.01).translate((0, 0, z1)), m3.Manifold.extrude(rounded(ow, ol, orr), 0.01).translate((0, 0, z1 + YARN_D))])
    band += m3.Manifold.extrude(outer, YARN_D).translate((0, 0, z1)) - slope
    return body - band


def yarn_holder(studs=False):
    keys = 1
    ow, ol, orr = SLOT_W + 2 * WALL, keys * PITCH + SLOT_END + 2 * WALL, SLOT_R + WALL
    out = yarn_band(holder(keys, 'corner'), ow, ol, orr)
    # tie hole in the corner tab, next to the body (the keyring uses the big hole further out)
    cx, cy = -(ow / 2 - orr), ol / 2 - orr; d = (orr + 1.6) / math.sqrt(2)
    out -= m3.Manifold.cylinder(10, TIE_HOLE / 2, TIE_HOLE / 2, 32).translate((cx - d, cy + d, -1))
    if studs:   # two studs on each long side of the upper wall, centred at the wall's middle height above the plate
        zc = (10.0 + TOP) / 2
        for side in (-1, 1):
            for y in (-STUD_PITCH / 2, STUD_PITCH / 2):
                s = stud().rotate((0, 0, 90 if side > 0 else -90)).translate((side * ow / 2, y, zc))
                out += s
    return out


if __name__ == '__main__':
    save(stud_test(), os.path.join(HERE, 'lego-stud-test.stl'))
    save(yarn_holder(), os.path.join(HERE, 'holder-1-yarn.stl'))
    save(yarn_holder(studs=True), os.path.join(HERE, 'holder-1-combo.stl'))
