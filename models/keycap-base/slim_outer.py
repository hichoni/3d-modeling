"""Slimmer outside for the booth keycap base, for holders and keychains whose square openings are tight on 18 mm.

Made for each shortened-socket keycap (0.5, 1.0 and 1.5 mm shorter cross post, shorten_socket.py). The original's outside tapers from 18.0 mm at the skirt bottom to 16.9 mm at the top. This trims it to a new taper,
SIZE at the bottom to TOP at the top, and makes it visibly rounder than the original so the two are easy to tell apart:
rounder corners low down (R 2.8 -> 3.4 mm, the original goes 2.0 -> 4.2), the top outer edge rounded off (R 0.45 mm)
and a 0.4 mm 45° chamfer on the bottom edge, which also keeps the first layer's squish inside SIZE. Nothing inside changes: the 14.3 mm pocket for the 14 mm printed plate
with its bumps and the switch socket are kept from the original, so only the walls get thinner. The rim around the
pocket keeps at least 0.85 mm (TOP = 16.0). The skirt keeps at least MIN_WALL: where the original's inner space flares
wider at the bottom (15.6 mm, 15.2 mm higher up), the slimmer skirt fills it back to that wall, taking at most ~0.15 mm
per side off the switch's room at the 16.5 mm size and ~0.05 mm at 17 mm.

    python3 models/keycap-base/slim_outer.py            # keycap-base-socket-{0.5,1.0,1.5}-outer{17,16.5}.stl
    python3 models/keycap-base/slim_outer.py 16.8       # any other bottom size
"""
import math, os, sys
import numpy as np
import manifold3d as m3
from shorten_socket import manifold_of, save

HERE = os.path.dirname(os.path.abspath(__file__))
SOCKETS = ('0.5', '1.0', '1.5')     # the shortened-socket keycaps from shorten_socket.py
HEIGHT, TOP = 9.2, 16.0              # keycap height; outside size at the top (pocket 14.3 + 2 x 0.85)
R_BOTTOM, R_TOP = 2.8, 3.4           # corner radius at the bottom and top (the top keeps > 0.85 mm at the pocket's corners)
FOOT, EDGE = 0.4, 0.45               # bottom edge chamfer; top outer edge rounding
MIN_WALL, SKIRT_TOP = 0.6, 4.9       # thinnest skirt wall; the skirt's inner space ends at 5.0 mm


def rounded(size, r, z):
    sec = m3.CrossSection.square((size - 2 * r, size - 2 * r), center=True).offset(r, m3.JoinType.Round, circular_segments=48)
    return m3.Manifold.extrude(sec, 0.001).translate((0, 0, z))


def outline(size, top, inset=0.0):
    at = lambda z: size + (top - size) * z / HEIGHT          # the straight taper's size at height z
    rings = [rounded(size - 2 * (FOOT + inset), R_BOTTOM - FOOT - inset, -0.001), rounded(size - 2 * inset, R_BOTTOM - inset, FOOT)]
    for i in range(7):                                       # quarter round on the top outer edge
        a = math.pi / 2 * i / 6; z = HEIGHT - EDGE + EDGE * math.sin(a); d = EDGE * (1 - math.cos(a))
        rings.append(rounded(at(z) - 2 * (inset + d), R_TOP - inset - d, z + (0.01 if i == 6 else 0)))
    return m3.Manifold.batch_hull(rings)


def slim(base, size):
    clip = outline(size, TOP)
    skirt = m3.Manifold.cube((size + 2, size + 2, SKIRT_TOP), center=False).translate((-(size + 2) / 2, -(size + 2) / 2, 0))
    liner = (clip - outline(size, TOP, MIN_WALL)) ^ skirt
    return (base ^ clip) + liner


if __name__ == '__main__':
    for socket in SOCKETS:
        base = manifold_of(os.path.join(HERE, 'keycap-base-socket-%s.stl' % socket))
        for size in (float(x) for x in (sys.argv[1:] or ['17', '16.5'])):
            save(slim(base, size), os.path.join(HERE, 'keycap-base-socket-%s-outer%g.stl' % (socket, size)))
