"""Slimmer outside for the booth keycap base, for holders and keychains whose square openings are tight on 18 mm.

The original's outside tapers from 18.0 mm at the skirt bottom to 16.9 mm at the top. This trims it to a new taper,
SIZE at the bottom to TOP at the top, with rounder corners going up as before, and a 0.25 mm chamfer on the bottom edge
so the first layer's squish stays inside SIZE. Nothing inside changes: the 14.3 mm pocket for the 14 mm printed plate
with its bumps and the switch socket are kept from the original, so only the walls get thinner. The rim around the
pocket keeps at least 0.85 mm (TOP = 16.0). The skirt keeps at least MIN_WALL: where the original's inner space flares
wider at the bottom (15.6 mm, 15.2 mm higher up), the slimmer skirt fills it back to that wall, taking at most ~0.15 mm
per side off the switch's room at the 16.5 mm size and ~0.05 mm at 17 mm.

    python3 models/keycap-base/slim_outer.py            # keycap-base-socket-0.5-outer17.stl and -outer16.5.stl
    python3 models/keycap-base/slim_outer.py 16.8       # any other bottom size
"""
import os, sys
import numpy as np
import manifold3d as m3
from shorten_socket import manifold_of, save

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'keycap-base-socket-0.5.stl')
HEIGHT, TOP = 9.2, 16.0              # keycap height; outside size at the top (pocket 14.3 + 2 x 0.85)
R_BOTTOM, R_TOP = 2.0, 3.8           # corner radius at the bottom and top, as the original's (2.05 -> 4.2)
FOOT = 0.25                          # bottom edge chamfer
MIN_WALL, SKIRT_TOP = 0.6, 4.9       # thinnest skirt wall; the skirt's inner space ends at 5.0 mm


def rounded(size, r, z):
    sec = m3.CrossSection.square((size - 2 * r, size - 2 * r), center=True).offset(r, m3.JoinType.Round, circular_segments=48)
    return m3.Manifold.extrude(sec, 0.001).translate((0, 0, z))


def outline(size, top, inset=0.0):
    return m3.Manifold.batch_hull([rounded(size - 2 * (FOOT + inset), R_BOTTOM - FOOT - inset, -0.001),
                                   rounded(size - 2 * inset, R_BOTTOM - inset, FOOT), rounded(top - 2 * inset, R_TOP - inset, HEIGHT + 0.01)])


def slim(base, size):
    clip = outline(size, TOP)
    skirt = m3.Manifold.cube((size + 2, size + 2, SKIRT_TOP), center=False).translate((-(size + 2) / 2, -(size + 2) / 2, 0))
    liner = (clip - outline(size, TOP, MIN_WALL)) ^ skirt
    return (base ^ clip) + liner


if __name__ == '__main__':
    base = manifold_of(SRC)
    for size in (float(x) for x in (sys.argv[1:] or ['17', '16.5'])):
        save(slim(base, size), os.path.join(HERE, 'keycap-base-socket-0.5-outer%g.stl' % size))
