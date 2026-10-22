"""Big stamp head for the keychain body: a keycap as wide as the body's top (23 mm) that holds a 20 x 20 mm name plate.

Replaces the booth keycap base (18 mm, 14 mm plate). A 19 mm skirt slides into the body's 19.6 mm well, so it fits the
bodies already printed. At rest the head floats 3.8 mm above the body; pressed, it lands on the body top just before
the switch bottoms out (4 mm), so stamping pressure goes into the body, not the switch.

    python3 models/keycap-head/stamp_head.py      # head + sample name plates (상상, AIERA)

Z below is in use orientation (0 = skirt bottom); the STL is written upside down (top face on the bed), which prints
without supports (only the pocket floor bridges).
Requires: pip install manifold3d trimesh fonttools mapbox_earcut
"""
import os, sys
import numpy as np
import manifold3d as m3

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'keychain'))
from keychain_body import rounded, prism, text_section, save, BODY_TOP, BODY_BOTTOM, BODY_R  # noqa: E402

# MX switch, from the plate top P: housing top P+7.0, stem top P+11.6, travel 4.0. Body top (well rim) is P+6.0.
REST = 8.0                       # skirt/socket bottom above P at rest: the stem's 3.6 mm cross fills the socket
STOP = 3.8                       # head lands on the body after 3.8 mm of travel
RIM = 6.0                        # body top above P
HEAD, HEAD_R = BODY_TOP, BODY_R * BODY_TOP / BODY_BOTTOM   # 23 mm, matching the body's top edge
SKIRT, SKIRT_R, SKIRT_WALL = 19.0, 1.2, 1.2                # inside the 19.6 mm well
SLAB_Z = RIM + STOP - REST                                 # 1.8: underside of the wide head
CAVITY_TOP = 4.6                                           # housing top reaches 2.8 at full travel (switch model); room to spare
ROOF = 1.0
PLATE, PLATE_R, PLATE_T = 20.0, 4.0, 3.0                   # name plate (booth stamp plate: 3.0 base + 1.5 letters)
POCKET, POCKET_R, POCKET_D = PLATE + 0.3, 4.15, 2.9
TOP = CAVITY_TOP + ROOF + POCKET_D                         # 8.5
TUBE, CROSS_L, CROSS_W, CROSS_D = 5.5, 4.16, 1.24, 3.7      # socket, as on the booth keycap base
EDGE = 0.5                                                  # top edge chamfer (also the bed-side edge when printing)
LIFT_D, LIFT_X = 2.2, 5.6                                   # holes to push the plate out from below


def cross(length, width, h):
    c = m3.CrossSection.square((length, width), center=True) + m3.CrossSection.square((width, length), center=True)
    return m3.Manifold.extrude(c, h)


def head():
    body = prism(SKIRT, SKIRT_R, 0, SLAB_Z + 0.01)
    body += prism(HEAD, HEAD_R, SLAB_Z, TOP - EDGE) + prism(HEAD, HEAD_R, TOP - EDGE, TOP, top=HEAD - 2 * EDGE)
    body -= prism(SKIRT - 2 * SKIRT_WALL, SKIRT_R, -1, CAVITY_TOP)
    body += prism(TUBE, 0.3, 0, CAVITY_TOP + 0.01)
    body -= cross(CROSS_L, CROSS_W, CROSS_D + 1).translate((0, 0, -1))
    k = (CROSS_L + 0.44) / CROSS_L                          # lead-in at the socket mouth
    body -= m3.Manifold.extrude(m3.CrossSection.square((CROSS_L, CROSS_W), center=True) + m3.CrossSection.square((CROSS_W, CROSS_L), center=True),
                                0.4, scale_top=(1 / k, 1 / k)).scale((k, k, 1)).translate((0, 0, -0.001))
    body -= prism(POCKET, POCKET_R, TOP - POCKET_D, TOP + 1)
    for x in (-LIFT_X, LIFT_X):
        body -= m3.Manifold.cylinder(ROOF + 2, LIFT_D / 2, LIFT_D / 2, 24).translate((x, 0, CAVITY_TOP - 1))
    return body


def plate(text):
    """Sample stamp plate (the booth makes these with the visitor's name): letters mirrored, 1.5 mm high."""
    sec = text_section(text, 10)
    (x0, y0), (x1, y1) = sec.bounds()[:2], sec.bounds()[2:]
    sec = sec.scale((min(15.0 / (x1 - x0), 13.0 / (y1 - y0)),) * 2).scale((-1, 1))
    return prism(PLATE, PLATE_R, 0, PLATE_T) + m3.Manifold.extrude(sec, 1.5 + 0.01).translate((0, 0, PLATE_T - 0.01))


def upside_down(man):
    return man.rotate((180, 0, 0)).translate((0, 0, TOP))


if __name__ == '__main__':
    save(upside_down(head()), os.path.join(HERE, 'stamp-head-23.stl'))
    for name, text in (('sangsang', '상상'), ('aiera', 'AIERA')):
        save(plate(text), os.path.join(HERE, 'stamp-plate-20-%s.stl' % name))
