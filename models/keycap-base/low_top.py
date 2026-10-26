"""Lower keycap top: the rim 1 mm lower, so it is level with the printed plate's 1.5 mm base instead of 1.5 mm above it.

The pocket wall is straight between 6.6 and 8.1 mm (the plate's snap bumps run full-width there, then taper to their tip
by 8.8 mm under the 0.4 mm lead-in at the top). LOWER mm of that straight band (from CUT) is taken out and everything above
moves down, so the bumps' tips, the lead-in and the top keep their shape; the pocket is 1.9 mm deep instead of 2.9.

    python3 models/keycap-base/low_top.py      # keycap-base-socket-{1.5,2.0}-low.stl and -low-outer17/16.5.stl (rounder)
"""
import os
import manifold3d as m3
from shorten_socket import manifold_of, save
import slim_outer

HERE = os.path.dirname(os.path.abspath(__file__))
CUT, LOWER = 7.0, 1.0
SOCKETS = ('1.5', '2.0')            # cross post shortened by; 2.0 is made by: python3 models/keycap-base/shorten_socket.py 2.0


def lowered(base):
    big = 40
    below = base ^ m3.Manifold.cube((big, big, CUT + 1)).translate((-big / 2, -big / 2, -1))
    above = base ^ m3.Manifold.cube((big, big, big)).translate((-big / 2, -big / 2, CUT + LOWER))
    return below + above.translate((0, 0, -LOWER))


if __name__ == '__main__':
    slim_outer.HEIGHT -= LOWER
    for socket in SOCKETS:
        low = lowered(manifold_of(os.path.join(HERE, 'keycap-base-socket-%s.stl' % socket)))
        save(low, os.path.join(HERE, 'keycap-base-socket-%s-low.stl' % socket))
        for size in (17.0, 16.5):
            save(slim_outer.slim(low, size), os.path.join(HERE, 'keycap-base-socket-%s-low-outer%g.stl' % (socket, size)))
