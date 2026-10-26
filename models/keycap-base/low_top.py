"""Lower keycap top: the rim 1 mm lower, so it is level with the printed plate's 1.5 mm base instead of 1.5 mm above it.

The pocket wall is straight between 6.6 and 8.1 mm (the plate's snap bumps run full-width there, then taper to their tip
by 8.8 mm under the 0.4 mm lead-in at the top). LOWER mm of that straight band (from CUT) is taken out and everything above
moves down, so the bumps' tips, the lead-in and the top keep their shape; the pocket is 1.9 mm deep instead of 2.9.

    python3 models/keycap-base/low_top.py      # keycap-base-socket-{1.5,2.0}-low.stl and -low-outer17/16.5.stl (rounder)

Both posts also come TIGHT (-low-tight*.stl) so the keycap stays on the switch: the cross hole is narrowed
from 4.16 x 1.24 to TIGHT_L x TIGHT_W (the MX stem is about 4.0 x 1.17; the original hole lets keycaps pull off), keeping the same lead-in at the mouth.
"""
import os
import manifold3d as m3
from shorten_socket import manifold_of, save, cross, CROSS_L, CROSS_W, CHAMFER_H, CHAMFER_GROW
import slim_outer

HERE = os.path.dirname(os.path.abspath(__file__))
CUT, LOWER = 7.0, 1.0
TIGHT_L, TIGHT_W, CEILING = 4.08, 1.16, 4.2     # tighter cross hole; the hole's top
SOCKETS = ('1.5', '2.0')            # cross post shortened by; 2.0 is made by: python3 models/keycap-base/shorten_socket.py 2.0


def lowered(base):
    big = 40
    below = base ^ m3.Manifold.cube((big, big, CUT + 1)).translate((-big / 2, -big / 2, -1))
    above = base ^ m3.Manifold.cube((big, big, big)).translate((-big / 2, -big / 2, CUT + LOWER))
    return below + above.translate((0, 0, -LOWER))


def tight(base, bottom):
    """Refill the cross hole (bottom..CEILING) and cut a narrower one with the original's lead-in."""
    plug = m3.Manifold.extrude(cross(CROSS_L + .6, CROSS_W + .6), CEILING - bottom - .02).translate((0, 0, bottom))
    out = base + plug
    hole = m3.Manifold.extrude(cross(TIGHT_L, TIGHT_W), CEILING - bottom + .5).translate((0, 0, bottom - .5))
    k = (TIGHT_L + CHAMFER_GROW) / TIGHT_L
    mouth = m3.Manifold.extrude(cross(TIGHT_L, TIGHT_W).scale((k, k)), CHAMFER_H, scale_top=(1 / k, 1 / k)).translate((0, 0, bottom - .001))
    return out - hole - mouth


if __name__ == '__main__':
    slim_outer.HEIGHT -= LOWER
    for socket in SOCKETS:
        low = lowered(manifold_of(os.path.join(HERE, 'keycap-base-socket-%s.stl' % socket)))
        save(low, os.path.join(HERE, 'keycap-base-socket-%s-low.stl' % socket))
        for size in (17.0, 16.5):
            save(slim_outer.slim(low, size), os.path.join(HERE, 'keycap-base-socket-%s-low-outer%g.stl' % (socket, size)))
    for socket in SOCKETS:
        low = tight(lowered(manifold_of(os.path.join(HERE, 'keycap-base-socket-%s.stl' % socket))), float(socket))
        save(low, os.path.join(HERE, 'keycap-base-socket-%s-low-tight.stl' % socket))
        for size in (17.0, 16.5):
            save(slim_outer.slim(low, size), os.path.join(HERE, 'keycap-base-socket-%s-low-tight-outer%g.stl' % (socket, size)))
