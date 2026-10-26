"""Tune the 1/2/3-key keychain holders (holder-N-original.stl, supplied) for MX switches and the 17 mm keycaps.

The holders: a 1.66 mm floor, a switch tube up to a 10.0 mm ledge where the switch's top housing rests, then a 7 mm rim
whose slot (17.65 mm wide, 17.5 mm key pitch) wraps the keycap. With solid booleans (manifold3d):
  - rim RIM_UP mm higher: the rim is straight from 10 to 17 mm, so its 11-12 mm band is repeated;
  - switch tube TUBE x TUBE mm, centred on each tube (was 13.89 x 13.80 / 13.80 x 13.88, too tight; 14.0 let the switch
    slip out, since this tube holds it by friction only: the keyring tunnel runs too close to the corner for a clip
    pocket like the slim holders');
  - PIN_ROOM mm more depth under the switch (the tube was exactly 8.3 mm, the MX housing below the flange plus its
    3.3 mm pins and centre post), leaving a 1.26 mm floor.

    python3 models/keychain-holder/tune_holder.py
"""
import os
import numpy as np
import manifold3d as m3
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
RIM_UP, TUBE, PIN_ROOM = 1.0, 13.9, 0.4   # 14.0 printed loose by friction alone; the slim holders lock the clips instead
LEDGE, FLOOR, BAND = 10.0, 1.661, (11.0, 12.0)


def tubes(mesh):
    """Each switch tube's bounds (xmin, xmax, ymin, ymax), from the section at 5 mm."""
    path = mesh.section(plane_origin=[0, 0, 5], plane_normal=[0, 0, 1]); poly, T = path.to_2D(); out = []
    for g in poly.polygons_full:
        for ring in g.interiors:
            c = np.c_[np.asarray(ring.coords), np.zeros(len(ring.coords)), np.ones(len(ring.coords))] @ T.T
            w, h = np.ptp(c[:, 0]), np.ptp(c[:, 1])
            if 13.5 < w < 14.2 and 13.5 < h < 14.2: out.append((c[:, 0].min(), c[:, 0].max(), c[:, 1].min(), c[:, 1].max()))
    return out


def box(x0, x1, y0, y1, z0, z1):
    return m3.Manifold.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def tune(mesh):
    solid = m3.Manifold(m3.Mesh(vert_properties=np.asarray(mesh.vertices, np.float32), tri_verts=np.asarray(mesh.faces, np.uint32)))
    lo, hi = mesh.bounds; big = (lo[0] - 1, hi[0] + 1, lo[1] - 1, hi[1] + 1)
    raised = (solid ^ box(*big, -1, BAND[1])) + ((solid ^ box(*big, BAND[0], hi[2] + 1)).translate((0, 0, RIM_UP)))
    for x0, x1, y0, y1 in tubes(mesh):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        raised -= box(cx - TUBE / 2, cx + TUBE / 2, cy - TUBE / 2, cy + TUBE / 2, FLOOR - PIN_ROOM, LEDGE + 0.5)
    g = raised.to_mesh()
    return trimesh.Trimesh(np.asarray(g.vert_properties)[:, :3], np.asarray(g.tri_verts), process=True)


if __name__ == '__main__':
    for keys in (1, 2, 3):
        src = trimesh.load(os.path.join(HERE, 'holder-%d-original.stl' % keys))
        out = tune(src); out.export(os.path.join(HERE, 'holder-%d.stl' % keys))
        print('holder-%d.stl' % keys, 'tubes', len(tubes(src)), 'watertight', out.is_watertight, 'volume %.1f -> %.1f' % (src.volume, out.volume), 'height %.2f' % out.bounds[1][2])
