"""Compact keyboard-style keychain for the booth keycap (18 mm base + 14 mm plate): 1 or 2 MX switches.

A low case holds the switches like a keyboard plate (top housing and keycap stand above it), keys at the standard
19.05 mm pitch. A flat loop sticks out diagonally from one bottom corner. Prints as is, floor on the bed, no supports.

    python3 models/keycap-keychain/compact_case.py            # 1-key and 2-key cases
Requires: pip install manifold3d trimesh fonttools mapbox_earcut
"""
import os, sys
import manifold3d as m3

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'keychain'))
from keychain_body import rounded, prism, text_section, save  # noqa: E402

PITCH = 19.05                     # keyboard key pitch; the 18 mm keycaps keep a 1 mm gap
R = 2.0                           # case corner radius
FLOOR = 1.2
CAVITY, CAVITY_R, CAVITY_H = 16.0, 1.0, 7.4   # switch bottom housing (3.5 below the plate) + pins/post (3.3) + 0.6
PLATE_T, CUTOUT, CUTOUT_R = 1.5, 14.05, 0.3   # same plate as the stamp body
HEIGHT = FLOOR + CAVITY_H + PLATE_T           # 10.1
EDGE = 0.6                                    # top and bottom edge chamfer
EAR_R, EAR_T, HOLE_D, EAR_OUT = 4.0, 3.0, 4.2, 4.0   # corner loop: radius, thickness, ring hole, reach past the corner
LOGO, LOGO_D = 'AIERA', 0.4                   # under the floor, reads right from below


def chamfered(w, h, z0, z1, e):
    def sec(inset):
        return m3.CrossSection.square((w - 2 * R, h - 2 * R), center=True).offset(R - inset, m3.JoinType.Round)
    return (m3.Manifold.batch_hull([m3.Manifold.extrude(sec(e), 0.01).translate((0, 0, z0)), m3.Manifold.extrude(sec(0), 0.01).translate((0, 0, z0 + e))])
            + m3.Manifold.extrude(sec(0), z1 - z0 - 2 * e).translate((0, 0, z0 + e))
            + m3.Manifold.batch_hull([m3.Manifold.extrude(sec(0), 0.01).translate((0, 0, z1 - e - 0.01)), m3.Manifold.extrude(sec(e), 0.01).translate((0, 0, z1 - 0.01))]))


def case(keys):
    w, h = PITCH * keys, PITCH
    out = chamfered(w, h, 0, HEIGHT, EDGE)
    # loop: a flat rounded tongue off the -X-Y corner, flush with the bed
    cx, cy = -w / 2 + R, -h / 2 + R; d = (R + EAR_OUT) / 2 ** 0.5
    ear = m3.CrossSection.batch_hull([m3.CrossSection.circle(R + 2).translate((cx, cy)), m3.CrossSection.circle(EAR_R).translate((cx - d, cy - d))])
    ear -= m3.CrossSection.circle(HOLE_D / 2).translate((cx - d, cy - d))
    out += m3.Manifold.extrude(ear, EAR_T)
    for i in range(keys):
        x = (i - (keys - 1) / 2) * PITCH
        out -= prism(CAVITY, CAVITY_R, FLOOR, FLOOR + CAVITY_H).translate((x, 0, 0))
        out -= prism(CUTOUT, CUTOUT_R, FLOOR + CAVITY_H - 0.01, HEIGHT + 1).translate((x, 0, 0))
    logo = text_section(LOGO, 3.2 if keys == 1 else 4.4).scale((-1, 1))
    return out - m3.Manifold.extrude(logo, LOGO_D + 0.01).translate((0, 0, -0.01))


if __name__ == '__main__':
    for k in (1, 2):
        save(case(k), os.path.join(HERE, 'keycap-keychain-%d.stl' % k))
