"""Stamp-style keychain body for the booth keycap.

Holds a standard MX-type keyboard switch (14 mm plate cutout, 1.5 mm plate) with the booth keycap base on top
(18 x 18 mm, 9.2 mm tall; 14 mm top plate pocket). The bottom is a seal face with a debossed border and text,
so the keychain also works as a stamp. Prints upright with the seal face on the bed, no supports.

    python3 models/keychain/keychain_body.py                 # standard + plain + long 30/40 mm + switch fit test
    python3 models/keychain/keychain_body.py --length 35     # any body length (18.5 mm and up), corner cord hole when long
    python3 models/keychain/keychain_body.py --length 35 --loop ear   # a loop sticking out of one corner instead
    python3 models/keychain/keychain_body.py --length 28 --loop tab --text CLICK --out /tmp/my-body.stl
Requires: pip install manifold3d trimesh fonttools mapbox_earcut
"""
import argparse, os
import numpy as np
import manifold3d as m3
import trimesh
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', '..', 'fonts', 'Jua-Regular.ttf')
m3.set_circular_segments(64)

# --- dimensions (mm) ---
BODY_BOTTOM, BODY_TOP, BODY_R = 24.0, 23.0, 3.5   # outer square, slight seal-like taper, corner radius
CHAMFER = 0.6                                     # bottom edge chamfer (also limits elephant's foot)
MIN_FACE = 3.0                                    # solid seal face under the switch (grows with --length)
CAVITY, CAVITY_R, CAVITY_H = 16.0, 1.0, 8.0       # room for the switch's lower housing, clips and pins (6.8 mm)
PLATE_T, CUTOUT, CUTOUT_R = 1.5, 14.05, 0.3       # MX plate: switch clips need 1.5 mm; 14.0 nominal + FDM allowance
WELL, WELL_R, WELL_D = 19.6, 1.5, 6.0             # keycap (18 mm) sinks into the body when pressed
BAND_TOP, BAND_H, BAND_D = 4.5, 1.0, 0.5          # decorative groove ending 4.5 mm below the top (and one near the bottom when long)
TAB_W, TAB_L, TAB_T, HOLE_D = 9.0, 5.5, 3.5, 4.2  # keyring tab at the bottom edge
CORD_D = 3.6                                      # cord hole through a long body (teardrop, prints without support)
CORNER_Z, CORNER_WALL = 6.3, 1.6                  # corner cord hole: centre height, wall left at the corner
EAR_Z, EAR_R, EAR_T, EAR_OUT = 9.5, 3.6, 3.5, 3.6 # corner loop: centre height, outer radius, thickness, reach
DEBOSS, TEXT, TEXT_H = 0.8, 'AIERA', 4.4          # seal face: border + text depth, text, cap height
TOP_PART = CAVITY_H + PLATE_T + WELL_D            # 15.5: everything above the seal face
STANDARD = MIN_FACE + TOP_PART                    # 18.5


def rounded(size, r):
    return m3.CrossSection.square((size - 2 * r, size - 2 * r), center=True).offset(r, m3.JoinType.Round)


def prism(size, r, z0, z1, top=None):
    s = top / size if top else 1.0
    return m3.Manifold.extrude(rounded(size, r), z1 - z0, scale_top=(s, s)).translate((0, 0, z0))


class FlattenPen(BasePen):
    """Glyph outline → closed polylines (quadratic/cubic curves sampled)."""
    def __init__(self, glyphs):
        super().__init__(glyphs); self.contours = []; self.cur = []
    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p): self.cur.append(p)
    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for t in np.linspace(0, 1, 8)[1:]:
            self.cur.append(((1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0], (1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]))
    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for t in np.linspace(0, 1, 10)[1:]:
            a, b, c, d = (1-t)**3, 3*(1-t)**2*t, 3*(1-t)*t*t, t**3
            self.cur.append((a*p0[0]+b*p1[0]+c*p2[0]+d*p3[0], a*p0[1]+b*p1[1]+c*p2[1]+d*p3[1]))
    def _closePath(self):
        if len(self.cur) > 2: self.contours.append(self.cur)
        self.cur = []
    _endPath = _closePath


def text_section(text, cap_height):
    font = TTFont(FONT); glyphs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
    polys, x = [], 0.0
    for ch in text:
        name = cmap[ord(ch)]; pen = FlattenPen(glyphs); glyphs[name].draw(pen)
        polys += [np.array([(px + x, py) for px, py in c]) for c in pen.contours]
        x += glyphs[name].width
    sec = m3.CrossSection(polys, m3.FillRule.NonZero)
    (x0, y0), (x1, y1) = sec.bounds()[:2], sec.bounds()[2:]
    # Latin caps keep the given cap height; Hangul and other full-height glyphs grow to fill the face (16.8 x 10 mm).
    k = min((cap_height if text.isascii() else 10.0) / (y1 - y0), 16.8 / (x1 - x0))
    return sec.translate((-(x0 + x1) / 2, -(y0 + y1) / 2)).scale((k, k))


def width_at(z, height):
    return BODY_BOTTOM + (BODY_TOP - BODY_BOTTOM) * z / height


def groove(z, height):
    size = width_at(z, height)
    return prism(size + 2, BODY_R, z, z + BAND_H) - prism(size - 2 * BAND_D, BODY_R - BAND_D, z - 1, z + BAND_H + 1)


def cord_hole(z):
    """Horizontal teardrop hole along X (point up, 45 degrees), centred at height z."""
    r = CORD_D / 2
    drop = m3.CrossSection.batch_hull([m3.CrossSection.circle(r), m3.CrossSection.square((0.01, 0.01), center=True).translate((0, r * 2 ** 0.5))])
    return m3.Manifold.extrude(drop, BODY_BOTTOM + 4).translate((0, 0, -(BODY_BOTTOM + 4) / 2)).rotate((0, 90, 0)).rotate((90, 0, 0)).rotate((0, 0, 90)).translate((0, 0, z))


def corner_reach(z, height):
    """Distance from the axis to the rounded corner along the diagonal at height z."""
    w = width_at(z, height); r = BODY_R * w / BODY_BOTTOM
    return (w / 2 - r) * 2 ** 0.5 + r


def teardrop(r):
    return m3.CrossSection.batch_hull([m3.CrossSection.circle(r), m3.CrossSection.square((0.01, 0.01), center=True).translate((0, r * 2 ** 0.5))])


def corner_hole(z, height):
    """Cord hole cutting across the +X+Y corner (in one side, out the next), point up so it prints without support."""
    r = CORD_D / 2; s = corner_reach(z, height) - r - CORNER_WALL; d = 1 / 2 ** 0.5
    return m3.Manifold.extrude(teardrop(r), 30).translate((0, 0, -15)).rotate((90, 0, 0)).rotate((0, 0, 45)).translate((s * d, s * d, z))


def corner_ear(z, height):
    """Loop sticking out of the +X+Y corner: a vertical lug with a sloped underside and a teardrop hole."""
    prof = m3.CrossSection.batch_hull([m3.CrossSection.circle(EAR_R).translate((EAR_OUT, 0)),
                                       m3.CrossSection.square((3, EAR_R * 2 + 3.5)).translate((-3, -EAR_R - 3.5))])
    lug = m3.Manifold.extrude(prof, EAR_T).translate((0, 0, -EAR_T / 2))
    hole = m3.Manifold.extrude(teardrop(CORD_D / 2 + 0.2).translate((EAR_OUT, 0)), EAR_T + 2).translate((0, 0, -EAR_T / 2 - 1))
    s = corner_reach(z, height); d = 1 / 2 ** 0.5
    place = lambda m: m.rotate((90, 0, 0)).rotate((0, 0, 45)).translate((s * d, s * d, z))
    return place(lug), place(hole)


def body(seal=True, length=STANDARD, loop='tab', text=TEXT):
    if length < STANDARD - 1e-6: raise ValueError('length must be at least %.1f mm' % STANDARD)
    face_t = length - TOP_PART; height = length
    outer = prism(BODY_BOTTOM, BODY_R, CHAMFER, height, top=BODY_TOP) + prism(BODY_BOTTOM - 2 * CHAMFER, BODY_R - CHAMFER, 0, CHAMFER, top=BODY_BOTTOM)
    # keyring tab: rounded tongue on the -Y side, flush with the bed
    tab = m3.CrossSection.batch_hull([m3.CrossSection([np.array([(-TAB_W / 2, 0), (TAB_W / 2, 0), (TAB_W / 2, 1), (-TAB_W / 2, 1)])]),
                                      m3.CrossSection.circle(TAB_W / 2).translate((0, -TAB_L))])
    tab = tab - m3.CrossSection.circle(HOLE_D / 2).translate((0, -TAB_L))
    if loop == 'tab': outer = outer + m3.Manifold.extrude(tab, TAB_T).translate((0, -BODY_BOTTOM / 2 + 1.5, 0))
    cut = prism(CAVITY, CAVITY_R, face_t, face_t + CAVITY_H)
    cut += prism(CUTOUT, CUTOUT_R, face_t + CAVITY_H - 0.01, face_t + CAVITY_H + PLATE_T + 0.01)
    cut += prism(WELL, WELL_R, height - WELL_D, height + 1)
    cut += groove(height - BAND_TOP - BAND_H, height)
    if face_t >= 10: cut += groove(3.5, height)                 # long seal: a second band near the face
    if loop == 'hole':
        if face_t < 9: raise ValueError('a cord hole needs --length %.1f or more' % (TOP_PART + 9))
        cut += cord_hole(face_t / 2 + (1.5 if face_t >= 10 else 0))
    if loop == 'corner':
        if face_t < 10: raise ValueError('a corner cord hole needs --length %.1f or more' % (TOP_PART + 10))
        cut += corner_hole(CORNER_Z, height)
    if seal:
        face = BODY_BOTTOM - 2 * CHAMFER - 2.4                               # border ring inside the chamfer
        ring = rounded(face, BODY_R - 1.8) - rounded(face - 1.8, BODY_R - 2.7)
        # Text reads normally from above; seen from the face (below) it is mirrored, so the stamp prints it right.
        sec = ring + text_section(text, TEXT_H) if text else ring
        cut += m3.Manifold.extrude(sec, DEBOSS + 0.01).translate((0, 0, -0.01))
    if loop == 'ear':
        lug, hole = corner_ear(EAR_Z, height)
        return (outer - cut + lug) - hole
    return outer - cut


def fit_test():
    """1.5 mm plate with 13.95 / 14.05 / 14.15 mm cutouts: print first to pick CUTOUT for your printer."""
    plate = m3.Manifold.extrude(m3.CrossSection.square((52, 20), center=True).offset(2, m3.JoinType.Round), PLATE_T)
    for i, size in enumerate((13.95, 14.05, 14.15)):
        x = (i - 1) * 18
        plate -= prism(size, CUTOUT_R, -1, PLATE_T + 1).translate((x, 1.0, 0))
        for k in range(i + 1):  # 1, 2, 3 notches mark the sizes
            plate -= m3.Manifold.cube((1.0, 2.2, PLATE_T + 2)).translate((x - 2.5 + k * 2, -12.6, -1))
    return plate


def save(man, path):
    mesh = man.to_mesh(); v = np.asarray(mesh.vert_properties)[:, :3]; f = np.asarray(mesh.tri_verts)
    tm = trimesh.Trimesh(v, f, process=True); tm.export(path)
    print(os.path.basename(path), 'watertight', tm.is_watertight, 'volume %.1f mm3' % tm.volume, 'extents', np.round(tm.extents, 2).tolist())
    return tm


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--length', type=float, help='body length in mm (%.1f and up); omit to write the standard set' % STANDARD)
    ap.add_argument('--loop', choices=['tab', 'corner', 'ear', 'hole'], help='keyring tab; cord hole across a corner (default from %.1f mm); '
                    'loop sticking out of a corner (any length); or the old hole through the middle' % (TOP_PART + 10))
    ap.add_argument('--text', default=TEXT, help='seal face text (Latin/Korean, about 5 characters); empty for border only')
    ap.add_argument('--plain', action='store_true', help='no seal face')
    ap.add_argument('--out', help='output STL path')
    a = ap.parse_args()
    if a.length is None:
        save(body(True), os.path.join(HERE, 'keychain-body.stl'))
        save(body(False), os.path.join(HERE, 'keychain-body-plain.stl'))
        for n in (30, 40): save(body(True, n, 'corner'), os.path.join(HERE, 'keychain-body-long-%d.stl' % n))
        save(fit_test(), os.path.join(HERE, 'switch-fit-test.stl'))
    else:
        loop = a.loop or ('corner' if a.length >= TOP_PART + 10 else 'tab')
        save(body(not a.plain, a.length, loop, a.text), a.out or os.path.join(HERE, 'keychain-body-%gmm.stl' % a.length))
