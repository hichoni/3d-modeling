"""Shorten the switch socket (the cross-hole tube) of the booth keycap base.

The tube runs from the skirt bottom (z=0) up to the plate, with a 4.16 mm cross hole about 4.2 mm deep. Raising the
tube bottom by d mm lowers the keycap on the switch by up to d (until the stem's cross, about 3.6 mm on MX switches,
reaches the top of the hole). The original's lead-in chamfer is recreated at the new opening.

    python3 models/keycap-base/shorten_socket.py      # writes keycap-base-socket-0.5/1.0/1.5.stl next to this file
"""
import os, sys
import numpy as np
import manifold3d as m3
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'keycap-base-original.stl')
TUBE = 5.5              # outer size of the socket tube (measured)
CROSS_L, CROSS_W = 4.16, 1.24
CHAMFER_H, CHAMFER_GROW = 0.4, 0.44  # lead-in: the cross mouth is 0.44 mm larger, closing over 0.4 mm


def manifold_of(path):
    t = trimesh.load(path)
    return m3.Manifold(m3.Mesh(vert_properties=np.asarray(t.vertices, np.float32), tri_verts=np.asarray(t.faces, np.uint32)))


def cross(length, width):
    a = m3.CrossSection.square((length, width), center=True)
    return a + m3.CrossSection.square((width, length), center=True)


def shortened(base, d):
    out = base - m3.Manifold.cube((TUBE + 1.5, TUBE + 1.5, d + 1), center=False).translate((-(TUBE + 1.5) / 2, -(TUBE + 1.5) / 2, -1))
    k = (CROSS_L + CHAMFER_GROW) / CROSS_L
    mouth = m3.Manifold.extrude(cross(CROSS_L, CROSS_W).scale((k, k)), CHAMFER_H, scale_top=(1 / k, 1 / k))
    return out - mouth.translate((0, 0, d - 0.001))


def save(man, path):
    g = man.to_mesh(); t = trimesh.Trimesh(np.asarray(g.vert_properties)[:, :3], np.asarray(g.tri_verts), process=True); t.export(path)
    print(os.path.basename(path), 'watertight', t.is_watertight, 'volume %.1f' % t.volume, 'bounds', np.round(t.bounds, 2).tolist())


if __name__ == '__main__':
    base = manifold_of(SRC)
    for d in (float(x) for x in (sys.argv[1:] or ['0.5', '1.0', '1.5'])):
        save(shortened(base, d), os.path.join(HERE, 'keycap-base-socket-%.1f.stl' % d))
