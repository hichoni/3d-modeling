"""Stamp-style keychain body for the booth keycap.

Holds a standard MX-type keyboard switch (14 mm plate cutout, 1.5 mm plate) with the booth keycap base on top
(18 x 18 mm, 9.2 mm tall; 14 mm top plate pocket). The bottom is a seal face with a debossed border and text,
so the keychain also works as a stamp. Prints upright with the seal face on the bed, no supports.

    python3 models/keychain/keychain_body.py   # writes keychain-body.stl, keychain-body-plain.stl, switch-fit-test.stl
Requires: pip install manifold3d trimesh fonttools mapbox_earcut
"""
import math, os, sys
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
FACE_T = 3.0                                      # solid seal face under the switch
CAVITY, CAVITY_R, CAVITY_H = 16.0, 1.0, 8.0       # room for the switch's lower housing, clips and pins (6.8 mm)
PLATE_T, CUTOUT, CUTOUT_R = 1.5, 14.05, 0.3       # MX plate: switch clips need 1.5 mm; 14.0 nominal + FDM allowance
WELL, WELL_R, WELL_D = 19.6, 1.5, 6.0             # keycap (18 mm) sinks into the body when pressed
BAND_Z, BAND_H, BAND_D = 13.0, 1.0, 0.5           # decorative groove around the body
TAB_W, TAB_L, TAB_T, HOLE_D = 9.0, 5.5, 3.5, 4.2  # keyring tab at the bottom edge
DEBOSS, TEXT, TEXT_H = 0.8, 'AIERA', 4.4          # seal face: border + text depth, text, cap height
HEIGHT = FACE_T + CAVITY_H + PLATE_T + WELL_D     # 18.5


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
    k = cap_height / (y1 - y0)
    return sec.translate((-(x0 + x1) / 2, -(y0 + y1) / 2)).scale((k, k))


def body(seal=True):
    outer = prism(BODY_BOTTOM, BODY_R, CHAMFER, HEIGHT, top=BODY_TOP) + prism(BODY_BOTTOM - 2 * CHAMFER, BODY_R - CHAMFER, 0, CHAMFER, top=BODY_BOTTOM)
    # keyring tab: rounded tongue on the -Y side, flush with the bed
    tab = m3.CrossSection.batch_hull([m3.CrossSection([np.array([(-TAB_W / 2, 0), (TAB_W / 2, 0), (TAB_W / 2, 1), (-TAB_W / 2, 1)])]),
                                      m3.CrossSection.circle(TAB_W / 2).translate((0, -TAB_L))])
    tab = tab - m3.CrossSection.circle(HOLE_D / 2).translate((0, -TAB_L))
    outer = outer + m3.Manifold.extrude(tab, TAB_T).translate((0, -BODY_BOTTOM / 2 + 1.5, 0))
    cut = prism(CAVITY, CAVITY_R, FACE_T, FACE_T + CAVITY_H)
    cut += prism(CUTOUT, CUTOUT_R, FACE_T + CAVITY_H - 0.01, FACE_T + CAVITY_H + PLATE_T + 0.01)
    cut += prism(WELL, WELL_R, HEIGHT - WELL_D, HEIGHT + 1)
    # groove band: everything between the outer surface and 0.5 mm inside, over 1 mm of height
    band_size = BODY_BOTTOM + (BODY_TOP - BODY_BOTTOM) * (BAND_Z / HEIGHT)
    cut += prism(band_size + 2, BODY_R, BAND_Z, BAND_Z + BAND_H) - prism(band_size - 2 * BAND_D, BODY_R - BAND_D, BAND_Z - 1, BAND_Z + BAND_H + 1)
    if seal:
        face = BODY_BOTTOM - 2 * CHAMFER - 2.4                               # border ring inside the chamfer
        ring = rounded(face, BODY_R - 1.8) - rounded(face - 1.8, BODY_R - 2.7)
        # Text reads normally from above; seen from the face (below) it is mirrored, so the stamp prints it right.
        sec = ring + text_section(TEXT, TEXT_H)
        cut += m3.Manifold.extrude(sec, DEBOSS + 0.01).translate((0, 0, -0.01))
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
    out = sys.argv[1] if len(sys.argv) > 1 else HERE
    save(body(True), os.path.join(out, 'keychain-body.stl'))
    save(body(False), os.path.join(out, 'keychain-body-plain.stl'))
    save(fit_test(), os.path.join(out, 'switch-fit-test.stl'))
