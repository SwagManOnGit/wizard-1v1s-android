# Builds the wizard model, in the chunky low-poly style of the reference art: a short, wide
# dwarf-wizard with a huge beard, a floppy pointed hat, a flared coat with gold trim, and boots.
#
# The model is code rather than a hand-edited mesh so it can be re-derived, and so the twenty
# swappable pieces (nine hats, nine staff heads, the boots) stay consistent with each other.
#
#   blender -b art/wizard-1v1s-models.blend --python tools/wizard-model.py
#
# It rebuilds the "Wizard" collection in place, leaves the arena and stage collections alone,
# exports app/src/assets/models/wizard.glb and saves the blend file.
#
# Contract with app/src/scene.ts, which must not be broken:
#   - materials named Robe, Cape, Hat, Trim, Skin, Beard, Boots, Wood, Dark, Orb, Crystal
#   - one empty per hat style named Hat_<Style>, one per staff head named Staff_<Style>
#   - an empty named ArmPivot carrying the staff arm, and a mesh named Orb for the glow anchor
#   - everything flat shaded: the renderer converts to Lambert and the facets are the look

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

# ---------------------------------------------------------------- scene helpers

COLLECTION = 'Wizard'

# Colours here are only what Blender shows; the game overwrites Robe/Hat/Cape/Trim/Skin/Beard/Boots
# per player from the equipped element. The rest ship as authored.
MATERIALS = {
    'Robe': (0.29, 0.31, 0.82),
    'Cape': (0.18, 0.18, 0.66),
    'Hat': (0.45, 0.28, 0.75),
    'Trim': (1.0, 0.80, 0.22),
    'Skin': (0.91, 0.76, 0.62),
    'Beard': (0.93, 0.93, 0.90),
    'Boots': (0.36, 0.22, 0.12),
    'Wood': (0.42, 0.29, 0.17),
    'Dark': (0.06, 0.05, 0.11),
    'Orb': (0.55, 0.80, 1.0),
    'Crystal': (0.45, 0.85, 1.0),
    'Bone': (0.88, 0.86, 0.78),
    'Metal': (0.62, 0.64, 0.72),
    'Leaf': (0.35, 0.78, 0.33),
}


def material(name):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
    rgb = MATERIALS.get(name)
    if rgb and mat.use_nodes:
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
            if 'Roughness' in bsdf.inputs:
                bsdf.inputs['Roughness'].default_value = 0.85
        mat.diffuse_color = (*rgb, 1.0)
    return mat


def fresh_collection():
    """Empties the Wizard collection without touching the arena or the stages."""
    coll = bpy.data.collections.get(COLLECTION)
    if coll is None:
        coll = bpy.data.collections.new(COLLECTION)
        bpy.context.scene.collection.children.link(coll)
    for obj in list(coll.objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is not None and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
    return coll


def add_mesh(name, verts, faces, mat, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([Vector(v) for v in verts], [], faces)
    mesh.validate()
    # Point every face outwards. Winding the face lists by hand is easy to get right and easy to get
    # silently wrong: an inside-out solid still renders in Blender, which draws back faces, and then
    # vanishes in the game, which culls them. The beard disappeared exactly this way.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = False          # flat shading is the whole style
    mesh.materials.append(material(mat))
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    obj.rotation_euler = Euler(rot)
    obj.scale = scale
    if parent is not None:
        obj.parent = parent
    COLL.objects.link(obj)
    return obj


def add_empty(name, parent=None, loc=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.1
    obj.location = loc
    if parent is not None:
        obj.parent = parent
    COLL.objects.link(obj)
    return obj


# ---------------------------------------------------------------- geometry

def ring(r, z, n, phase=0.0, sx=1.0, sy=1.0, cx=0.0, cy=0.0):
    out = []
    for i in range(n):
        a = phase + (i / n) * math.tau
        out.append((cx + math.cos(a) * r * sx, cy + math.sin(a) * r * sy, z))
    return out


def loft(rings, cap_bottom=True, cap_top=True):
    """Stitches a list of equal-length vertex rings into a closed solid."""
    verts = []
    for r in rings:
        verts.extend(r)
    n = len(rings[0])
    faces = []
    for k in range(len(rings) - 1):
        a, b = k * n, (k + 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append([a + i, a + j, b + j, b + i])
    if cap_bottom:
        faces.append(list(range(n - 1, -1, -1)))
    if cap_top:
        base = (len(rings) - 1) * n
        faces.append([base + i for i in range(n)])
    return verts, faces


def tube(profile, n, phase=0.0):
    """profile: [(radius, z, sx, sy, cx, cy)] bottom to top."""
    rings = []
    for p in profile:
        r, z = p[0], p[1]
        sx = p[2] if len(p) > 2 else 1.0
        sy = p[3] if len(p) > 3 else 1.0
        cx = p[4] if len(p) > 4 else 0.0
        cy = p[5] if len(p) > 5 else 0.0
        rings.append(ring(r, z, n, phase, sx, sy, cx, cy))
    return loft(rings)


def cone_to_point(r, z0, z1, n, phase=0.0, tip=(0.0, 0.0)):
    verts = ring(r, z0, n, phase)
    verts.append((tip[0], tip[1], z1))
    apex = len(verts) - 1
    faces = [[i, (i + 1) % n, apex] for i in range(n)]
    faces.append(list(range(n - 1, -1, -1)))
    return verts, faces


def box(sx, sy, sz):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    verts = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
             (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    return verts, faces


def gem(r, z0, z1, waist, n=6, phase=0.0):
    """A faceted crystal: point down, a waist, point up. The staff head of the reference art."""
    mid = z0 + (z1 - z0) * waist
    verts = [(0, 0, z0)] + ring(r, mid, n, phase) + [(0, 0, z1)]
    top = len(verts) - 1
    faces = [[0, 1 + (i + 1) % n, 1 + i] for i in range(n)]
    faces += [[1 + i, 1 + (i + 1) % n, top] for i in range(n)]
    return verts, faces


def star(points, r_out, r_in, depth):
    """A flat star extruded along y, for the emblems on the coat."""
    front, back = [], []
    for i in range(points * 2):
        a = math.pi / 2 + (i / (points * 2)) * math.tau
        r = r_out if i % 2 == 0 else r_in
        front.append((math.cos(a) * r, -depth / 2, math.sin(a) * r))
        back.append((math.cos(a) * r, depth / 2, math.sin(a) * r))
    n = points * 2
    verts = front + back
    faces = [list(range(n - 1, -1, -1)), [n + i for i in range(n)]]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    return verts, faces


def ball(r, segs=8, rings=5, squash=1.0):
    verts = [(0, 0, -r * squash)]
    for k in range(1, rings):
        t = k / rings
        z = -math.cos(t * math.pi) * r * squash
        rr = math.sin(t * math.pi) * r
        verts.extend(ring(rr, z, segs))
    verts.append((0, 0, r * squash))
    top = len(verts) - 1
    faces = [[0, 1 + (i + 1) % segs, 1 + i] for i in range(segs)]
    for k in range(rings - 2):
        a, b = 1 + k * segs, 1 + (k + 1) * segs
        faces += [[a + i, a + (i + 1) % segs, b + (i + 1) % segs, b + i] for i in range(segs)]
    last = 1 + (rings - 2) * segs
    faces += [[last + i, last + (i + 1) % segs, top] for i in range(segs)]
    return verts, faces


def arc_shell(profile, a0, a1, segs, thickness):
    """
    A band of a solid of revolution that does not go all the way round: an outer wall, an inner
    wall and caps at both open ends. Used for hair, which has to wrap the back and sides of the
    head and stop before the face.

    profile: [(radius, z)] bottom to top. Winding is left to recalc_face_normals.
    """
    rows, w = len(profile), segs + 1

    def wall(radial):
        out = []
        for r, z in profile:
            for i in range(w):
                a = a0 + (a1 - a0) * i / segs
                rr = max(0.01, r - radial)
                out.append((math.cos(a) * rr, math.sin(a) * rr, z))
        return out

    verts = wall(0.0) + wall(thickness)
    inner = rows * w
    faces = []
    for k in range(rows - 1):
        for i in range(segs):
            o, p = k * w + i, (k + 1) * w + i
            faces.append([o, o + 1, p + 1, p])                                        # outside
            faces.append([inner + p, inner + p + 1, inner + o + 1, inner + o])        # inside
        for i in (0, segs):                                                           # the two ends
            o, p = k * w + i, (k + 1) * w + i
            faces.append([o, p, inner + p, inner + o])
    for i in range(segs):                                                             # bottom, top
        faces.append([inner + i, inner + i + 1, i + 1, i])
        t = (rows - 1) * w + i
        faces.append([t, t + 1, inner + t + 1, inner + t])
    return verts, faces


def torus(r_major, r_minor, seg=12, side=6, squash=1.0):
    verts, faces = [], []
    for i in range(seg):
        a = (i / seg) * math.tau
        cx, cy = math.cos(a) * r_major, math.sin(a) * r_major
        for j in range(side):
            b = (j / side) * math.tau
            rr = r_major + math.cos(b) * r_minor
            verts.append((math.cos(a) * rr, math.sin(a) * rr, math.sin(b) * r_minor * squash))
    for i in range(seg):
        ni = (i + 1) % seg
        for j in range(side):
            nj = (j + 1) % side
            faces.append([i * side + j, ni * side + j, ni * side + nj, i * side + nj])
    return verts, faces


# ---------------------------------------------------------------- the wizard

COLL = None


def build():
    root = add_empty('WizardRoot')

    # -------- boots. The reference plants him on two chunky boots under the coat.
    for side, x in (('L', -0.23), ('R', 0.23)):
        v, f = tube([(0.18, 0.0), (0.19, 0.16), (0.165, 0.40)], 6, phase=math.pi / 6)
        add_mesh(f'Boot{side}', v, f, 'Boots', root, loc=(x, 0.0, 0.0))
        v, f = box(0.28, 0.34, 0.15)
        add_mesh(f'Toe{side}', v, f, 'Boots', root, loc=(x, -0.20, 0.075))

    # -------- the coat: wide at the hem, narrowing to the shoulders, ten flat facets.
    v, f = tube([(0.70, 0.32), (0.66, 0.62), (0.58, 0.98), (0.50, 1.30), (0.46, 1.62)], 10, phase=math.pi / 10)
    add_mesh('Robe', v, f, 'Robe', root)

    # Hem and belt bands in gold, the way the reference edges everything.
    v, f = tube([(0.73, 0.31), (0.73, 0.42)], 10, phase=math.pi / 10)
    add_mesh('Hem', v, f, 'Trim', root)
    v, f = tube([(0.60, 1.00), (0.60, 1.13)], 10, phase=math.pi / 10)
    add_mesh('Belt', v, f, 'Wood', root)
    v, f = box(0.16, 0.07, 0.15)
    add_mesh('Buckle', v, f, 'Trim', root, loc=(0, -0.55, 1.065))

    # The front of the coat: one narrow panel in the hat colour with a gold edge either side. The
    # first pass used two wide lapels, which from three-quarters read as a pair of flat blue wings.
    v, f = tube([(0.20, 1.05, 1.0, 0.20), (0.24, 1.70, 1.0, 0.20)], 6, phase=math.pi / 6)
    add_mesh('Placket', v, f, 'Cape', root, loc=(0, -0.40, 0.0), rot=(0.06, 0, 0))
    for side, x in (('L', -0.21), ('R', 0.21)):
        v, f = box(0.05, 0.05, 0.64)
        add_mesh(f'PlacketEdge{side}', v, f, 'Trim', root, loc=(x, -0.48, 1.38), rot=(0.06, 0, 0))

    # Two stars on the skirt, the emblem the reference wears.
    for side, x in (('L', -0.30), ('R', 0.30)):
        v, f = star(5, 0.14, 0.062, 0.05)
        add_mesh(f'Star{side}', v, f, 'Trim', root, loc=(x, -0.58, 0.72), rot=(0, 0, 0))

    # -------- shoulders and a gold band at the neck. A standing collar stood here too; from behind
    # it read as a disc stuck to the back of the head, and the hair fills that gap better.
    v, f = ball(0.47, 10, 4, squash=0.55)
    add_mesh('Shoulders', v, f, 'Robe', root, loc=(0, 0, 1.58))
    v, f = tube([(0.50, 1.53), (0.50, 1.63)], 10, phase=math.pi / 10)
    add_mesh('CollarTrim', v, f, 'Trim', root, loc=(0, 0.03, 0), rot=(-0.14, 0, 0))

    # -------- arms. The left hangs; the right is on the pivot the game raises to cast.
    pivot = add_empty('ArmPivot', root, loc=(0.45, 0, 1.55))
    v, f = tube([(0.215, 0.0), (0.15, 0.26), (0.125, 0.52)], 6, phase=math.pi / 6)
    add_mesh('ArmL', v, f, 'Robe', root, loc=(-0.44, -0.08, 0.98), rot=(0.12, -0.22, 0))
    add_mesh('SleeveL', *tube([(0.235, -0.04), (0.215, 0.10)], 8), mat='Cape', parent=root,
             loc=(-0.44, -0.08, 0.98), rot=(0.12, -0.22, 0))
    v, f = ball(0.135, 8, 4)
    add_mesh('HandL', v, f, 'Skin', root, loc=(-0.47, -0.12, 0.88))

    v, f = tube([(0.215, 0.0), (0.15, 0.26), (0.125, 0.52)], 6, phase=math.pi / 6)
    add_mesh('ArmR', v, f, 'Robe', pivot, loc=(0.06, -0.14, -0.57), rot=(0.18, 0.20, 0))
    add_mesh('SleeveR', *tube([(0.235, -0.04), (0.215, 0.10)], 8), mat='Cape', parent=pivot,
             loc=(0.06, -0.14, -0.57), rot=(0.18, 0.20, 0))
    v, f = ball(0.135, 8, 4)
    add_mesh('HandR', v, f, 'Skin', pivot, loc=(0.16, -0.20, -0.66))

    # -------- head. Much larger than the old one: the reference is about three heads tall.
    v, f = ball(0.42, 10, 6, squash=0.95)
    add_mesh('Head', v, f, 'Skin', root, loc=(0, 0, 1.98))

    # Hair around the back and sides, hugging the skull and stopping short of the face. It shares
    # the Beard material, so whatever colour the player picks for the beard, the hair matches.
    v, f = arc_shell(
        [(0.35, 1.70), (0.44, 1.80), (0.465, 1.96), (0.44, 2.10), (0.34, 2.24)],
        math.radians(-42), math.radians(222), 14, 0.075,
    )
    add_mesh('Hair', v, f, 'Beard', root, loc=(0, 0, 0))
    # Two locks in front of the ears, to tie the hair into the beard rather than end at the jaw.
    for side, x in (('L', -0.40), ('R', 0.40)):
        v, f = ball(0.13, 6, 4, squash=1.35)
        add_mesh(f'Lock{side}', v, f, 'Beard', root, loc=(x, -0.08, 1.80))
    v, f = ball(0.135, 6, 4, squash=1.20)
    add_mesh('Nose', v, f, 'Skin', root, loc=(0, -0.40, 1.95))
    for side, x in (('0', -0.155), ('1', 0.155)):
        v, f = ball(0.058, 6, 4)
        add_mesh(f'Eye{side}', v, f, 'Dark', root, loc=(x, -0.345, 2.10))
        v, f = box(0.15, 0.06, 0.055)
        add_mesh(f'Brow{side}', v, f, 'Beard', root, loc=(x, -0.345, 2.20),
                 rot=(0, -0.28 if x < 0 else 0.28, 0))

    # -------- the beard. Stacked lobes, widest at the jaw, tapering to a blunt point.
    beard = [
        (0.42, 1.90, 1.00, 0.78), (0.50, 1.74, 1.00, 0.82), (0.50, 1.56, 1.00, 0.86),
        (0.45, 1.38, 1.00, 0.90), (0.36, 1.20, 1.00, 0.94), (0.17, 1.00, 1.00, 0.98),
    ]
    v, f = tube(beard, 8, phase=math.pi / 8)
    add_mesh('Beard', v, f, 'Beard', root, loc=(0, -0.20, 0))
    for side, x in (('L', -0.17), ('R', 0.17)):
        v, f = ball(0.155, 6, 4, squash=0.60)
        add_mesh(f'Tash{side}', v, f, 'Beard', root, loc=(x, -0.40, 1.87), rot=(0, 0.25 if x > 0 else -0.25, 0))

    build_hats(root)
    build_staffs(pivot)
    return root


# ---------------------------------------------------------------- hats
# Every style is parented to its own empty. The game shows exactly one and hides the rest, so they
# all sit on the same head at the same height.

HAT_Z = 2.32          # where a brim rests on the new, larger head


def build_hats(root):
    def anchor(style):
        return add_empty(f'Hat_{style}', root)

    # Pointy: the reference hat. A wide brim that dips at the front, then a cone that leans and
    # folds over at the tip.
    a = anchor('Pointy')
    v, f = tube([(0.86, HAT_Z - 0.03, 1.0, 1.0), (0.80, HAT_Z + 0.07)], 12, phase=math.pi / 12)
    add_mesh('Brim', v, f, 'Hat', a, rot=(0.06, 0, 0))
    v, f = tube([(0.44, HAT_Z + 0.04), (0.40, HAT_Z + 0.20)], 12, phase=math.pi / 12)
    add_mesh('Band', v, f, 'Trim', a, rot=(0.06, 0, 0))
    # Three leaning segments make the flop without a bone or a modifier.
    v, f = tube([(0.42, 0.0), (0.33, 0.34)], 10, phase=math.pi / 10)
    add_mesh('HatCone', v, f, 'Hat', a, loc=(0, 0, HAT_Z + 0.12))
    v, f = tube([(0.33, 0.0), (0.22, 0.32)], 10, phase=math.pi / 10)
    add_mesh('HatCone2', v, f, 'Hat', a, loc=(0.045, 0.02, HAT_Z + 0.46), rot=(0, 0.26, 0))
    v, f = cone_to_point(0.22, 0.0, 0.40, 10, tip=(0.20, 0.06))
    add_mesh('HatTip', v, f, 'Hat', a, loc=(0.145, 0.05, HAT_Z + 0.76), rot=(0.10, 0.62, 0))

    # Hood: a cowl that swallows the head, with a drooping point behind.
    a = anchor('Hood')
    v, f = ball(0.50, 10, 5, squash=1.05)
    add_mesh('HV_Hood', v, f, 'Hat', a, loc=(0, 0.05, 2.08))
    v, f = cone_to_point(0.22, 0.0, 0.55, 8, tip=(0.0, 0.40))
    add_mesh('HV_HoodTip', v, f, 'Hat', a, loc=(0, 0.28, 2.32), rot=(0.95, 0, 0))
    v, f = tube([(0.46, 0.0), (0.46, 0.10)], 10, phase=math.pi / 10)
    add_mesh('HV_HoodTrim', v, f, 'Trim', a, loc=(0, 0.05, 1.86))

    # Crown: a gold band with spikes.
    a = anchor('Crown')
    v, f = tube([(0.44, HAT_Z - 0.06), (0.44, HAT_Z + 0.14)], 10, phase=math.pi / 10)
    add_mesh('HV_CrownBand', v, f, 'Trim', a)
    for i in range(6):
        ang = (i / 6) * math.tau
        v, f = cone_to_point(0.09, 0.0, 0.26, 5)
        add_mesh(f'HV_Spike{i}', v, f, 'Trim', a,
                 loc=(math.cos(ang) * 0.42, math.sin(ang) * 0.42, HAT_Z + 0.12))
    v, f = gem(0.10, -0.10, 0.10, 0.45, 6)
    add_mesh('HV_Gem', v, f, 'Crystal', a, loc=(0, -0.44, HAT_Z + 0.06))

    # Horns: a skullcap with two curved horns.
    a = anchor('Horns')
    v, f = ball(0.44, 10, 4, squash=0.62)
    add_mesh('HV_Cap', v, f, 'Hat', a, loc=(0, 0, HAT_Z - 0.02))
    for side, x, tilt in (('-1', -0.34, -0.55), ('1', 0.34, 0.55)):
        v, f = cone_to_point(0.13, 0.0, 0.46, 6)
        add_mesh(f'HV_Horn{side}', v, f, 'Bone', a, loc=(x, 0.02, HAT_Z + 0.05), rot=(0, tilt, 0))

    # Wide: a flat travelling hat, brim first.
    a = anchor('Wide')
    v, f = tube([(0.94, HAT_Z - 0.04), (0.88, HAT_Z + 0.04)], 12, phase=math.pi / 12)
    add_mesh('HV_WideBrim', v, f, 'Hat', a)
    v, f = tube([(0.40, HAT_Z + 0.02), (0.28, HAT_Z + 0.34)], 10, phase=math.pi / 10)
    add_mesh('HV_WideCone', v, f, 'Hat', a)
    v, f = tube([(0.42, HAT_Z + 0.04), (0.41, HAT_Z + 0.14)], 10, phase=math.pi / 10)
    add_mesh('HV_WideBand', v, f, 'Trim', a)

    # Turban: stacked coils, a jewel and a plume.
    a = anchor('Turban')
    for i, (r, z) in enumerate(((0.46, 0.0), (0.43, 0.14), (0.36, 0.26))):
        v, f = torus(r, 0.10, 12, 6, squash=0.8)
        add_mesh(f'HV_Turban{i + 1}', v, f, 'Hat', a, loc=(0, 0, HAT_Z + z))
    v, f = ball(0.13, 8, 4)
    add_mesh('HV_TurbanTop', v, f, 'Hat', a, loc=(0, 0, HAT_Z + 0.36))
    v, f = gem(0.09, -0.09, 0.09, 0.45, 6)
    add_mesh('HV_Jewel', v, f, 'Crystal', a, loc=(0, -0.42, HAT_Z + 0.10))
    v, f = cone_to_point(0.06, 0.0, 0.40, 5, tip=(0.0, 0.16))
    add_mesh('HV_Plume', v, f, 'Trim', a, loc=(0, -0.28, HAT_Z + 0.22), rot=(-0.45, 0, 0))

    # Halo: rings and rays, floating just clear of the head rather than a hand's width above it.
    a = anchor('Halo')
    v, f = torus(0.40, 0.045, 16, 6, squash=0.7)
    add_mesh('HV2_Halo', v, f, 'Trim', a, loc=(0, 0, HAT_Z + 0.20))
    v, f = torus(0.29, 0.028, 14, 6, squash=0.7)
    add_mesh('HV2_HaloInner', v, f, 'Crystal', a, loc=(0, 0, HAT_Z + 0.20))
    for i in range(6):
        ang = (i / 6) * math.tau
        v, f = cone_to_point(0.035, 0.0, 0.17, 4)
        add_mesh(f'HV2_Ray{i}', v, f, 'Crystal', a,
                 loc=(math.cos(ang) * 0.40, math.sin(ang) * 0.40, HAT_Z + 0.24))

    # Helm: a steel cap with a nose guard and a crest.
    a = anchor('Helm')
    v, f = ball(0.45, 10, 5, squash=0.78)
    add_mesh('HV2_Helm', v, f, 'Metal', a, loc=(0, 0, HAT_Z + 0.02))
    v, f = torus(0.45, 0.05, 12, 6, squash=0.8)
    add_mesh('HV2_HelmBand', v, f, 'Trim', a, loc=(0, 0, HAT_Z - 0.04))
    v, f = box(0.10, 0.10, 0.34)
    add_mesh('HV2_Nose', v, f, 'Metal', a, loc=(0, -0.42, HAT_Z - 0.10))
    v, f = box(0.09, 0.62, 0.20)
    add_mesh('HV2_Crest', v, f, 'Trim', a, loc=(0, 0, HAT_Z + 0.30))

    # Veil: a hanging shroud with a toothed edge.
    a = anchor('Veil')
    v, f = ball(0.47, 10, 5, squash=0.72)
    add_mesh('HV2_Veil', v, f, 'Hat', a, loc=(0, 0, HAT_Z + 0.02))
    v, f = torus(0.47, 0.05, 12, 6, squash=0.8)
    add_mesh('HV2_VeilRing', v, f, 'Trim', a, loc=(0, 0, HAT_Z - 0.06))
    for i in range(4):
        v, f = cone_to_point(0.07, 0.0, 0.22, 4)
        add_mesh(f'HV2_Tooth{i}', v, f, 'Hat', a,
                 loc=(-0.30 + i * 0.20, -0.34, HAT_Z - 0.06), rot=(math.pi, 0, 0))


# ---------------------------------------------------------------- staffs
# The shaft belongs to the arm; only the head changes. Orb sits inside the claw variant because the
# game reads its world position for the spell glow, so it must exist whichever head is shown.

STAFF_TOP = 1.27      # local to ArmPivot: the top of the shaft


def build_staffs(pivot):
    v, f = tube([(0.055, -1.05), (0.050, 0.25), (0.055, 1.27)], 6, phase=math.pi / 6)
    add_mesh('Staff', v, f, 'Wood', pivot, loc=(0.26, -0.22, 0))
    for z in (-0.55, 0.62):
        v, f = torus(0.075, 0.03, 8, 5, squash=0.7)
        add_mesh(f'StaffKnot{z}', v, f, 'Wood', pivot, loc=(0.26, -0.22, z))

    # The spell glow and every projectile start here. It used to be the claw variant's orb, which
    # meant eight of the nine staff heads cast from a hidden node and showed no glow at all.
    add_empty('OrbAnchor', pivot, loc=(0.26, -0.22, STAFF_TOP + 0.22))

    def anchor(style):
        return add_empty(f'Staff_{style}', pivot)

    head = (0.26, -0.22, STAFF_TOP)

    # Claw: three prongs cradling the orb. The default, and the one that owns Orb.
    a = anchor('Claw')
    for i in range(3):
        ang = (i / 3) * math.tau
        v, f = cone_to_point(0.035, 0.0, 0.30, 4)
        add_mesh(f'Prong{i}', v, f, 'Wood', a,
                 loc=(head[0] + math.cos(ang) * 0.09, head[1] + math.sin(ang) * 0.09, head[2]),
                 rot=(math.sin(ang) * 0.5, -math.cos(ang) * 0.5, 0))
    v, f = ball(0.125, 8, 5)
    add_mesh('Orb', v, f, 'Orb', a, loc=(head[0], head[1], head[2] + 0.22))

    # Crystal: the faceted shard from the reference.
    a = anchor('Crystal')
    v, f = gem(0.145, -0.12, 0.46, 0.38, 6)
    add_mesh('SV_Shard', v, f, 'Crystal', a, loc=head)
    v, f = gem(0.075, -0.06, 0.20, 0.40, 5)
    add_mesh('SV_ShardLow', v, f, 'Crystal', a, loc=(head[0] + 0.10, head[1] + 0.02, head[2] - 0.02),
             rot=(0, 0.45, 0))
    v, f = torus(0.10, 0.032, 8, 5, squash=0.8)
    add_mesh('SV_ShardRing', v, f, 'Trim', a, loc=(head[0], head[1], head[2] - 0.06))

    # Ring: an open circle with a bead.
    a = anchor('Ring')
    v, f = torus(0.20, 0.045, 14, 6)
    add_mesh('SV_Ring', v, f, 'Trim', a, loc=(head[0], head[1], head[2] + 0.20), rot=(math.pi / 2, 0, 0))
    v, f = ball(0.075, 6, 4)
    add_mesh('SV_Bead', v, f, 'Crystal', a, loc=(head[0], head[1], head[2] + 0.40))

    # Blade: a spearhead with a gem at its root.
    a = anchor('Blade')
    v, f = cone_to_point(0.115, 0.0, 0.48, 4, phase=math.pi / 4)
    add_mesh('SV_Blade', v, f, 'Metal', a, loc=head)
    v, f = gem(0.075, -0.07, 0.07, 0.45, 6)
    add_mesh('SV_BladeGem', v, f, 'Crystal', a, loc=(head[0], head[1], head[2] - 0.02))

    # Skull: a bone head with lit sockets.
    a = anchor('Skull')
    v, f = ball(0.155, 8, 5, squash=0.92)
    add_mesh('SV_Skull', v, f, 'Bone', a, loc=(head[0], head[1], head[2] + 0.14))
    v, f = box(0.16, 0.14, 0.08)
    add_mesh('SV_Jaw', v, f, 'Bone', a, loc=(head[0], head[1] - 0.04, head[2] + 0.02))
    for side, x in (('-1', -0.06), ('1', 0.06)):
        v, f = ball(0.042, 5, 3)
        add_mesh(f'SV_Socket{side}', v, f, 'Dark', a, loc=(head[0] + x, head[1] - 0.115, head[2] + 0.17))
    v, f = ball(0.10, 6, 4)
    add_mesh('SV_SkullGlow', v, f, 'Crystal', a, loc=(head[0], head[1], head[2] + 0.14))

    # Leaf: a bud and three leaves.
    a = anchor('Leaf')
    v, f = ball(0.085, 6, 4)
    add_mesh('SV_Bud', v, f, 'Leaf', a, loc=(head[0], head[1], head[2] + 0.12))
    for i in range(3):
        ang = (i / 3) * math.tau
        v, f = ball(0.13, 6, 4, squash=0.30)
        add_mesh(f'SV_Leaf{i}', v, f, 'Leaf', a,
                 loc=(head[0] + math.cos(ang) * 0.14, head[1] + math.sin(ang) * 0.14, head[2] + 0.18),
                 rot=(math.sin(ang) * 0.8, -math.cos(ang) * 0.8, 0))

    # Sun: a disc with rays.
    a = anchor('Sun')
    v, f = ball(0.115, 8, 4, squash=0.55)
    add_mesh('SV2_SunCore', v, f, 'Crystal', a, loc=(head[0], head[1], head[2] + 0.18), rot=(math.pi / 2, 0, 0))
    for i in range(8):
        ang = (i / 8) * math.tau
        v, f = cone_to_point(0.032, 0.0, 0.16, 4)
        add_mesh(f'SV2_SunRay{i}', v, f, 'Trim', a,
                 loc=(head[0] + math.cos(ang) * 0.13, head[1], head[2] + 0.18 + math.sin(ang) * 0.13),
                 rot=(math.pi / 2, 0, -ang + math.pi / 2))

    # Hammer: a blunt head with a gem in its cheek.
    a = anchor('Hammer')
    v, f = box(0.40, 0.20, 0.22)
    add_mesh('SV2_Head', v, f, 'Metal', a, loc=(head[0], head[1], head[2] + 0.14))
    v, f = box(0.10, 0.22, 0.24)
    add_mesh('SV2_Face', v, f, 'Trim', a, loc=(head[0] + 0.19, head[1], head[2] + 0.14))
    v, f = gem(0.055, -0.05, 0.05, 0.45, 6)
    add_mesh('SV2_HammerGem', v, f, 'Crystal', a, loc=(head[0], head[1] - 0.11, head[2] + 0.14))

    # Hourglass: two cones in a cage.
    a = anchor('Hourglass')
    v, f = cone_to_point(0.125, 0.30, 0.02, 6)
    add_mesh('SV2_GlassTop', v, f, 'Crystal', a, loc=(head[0], head[1], head[2] + 0.06))
    v, f = cone_to_point(0.125, -0.10, 0.18, 6)
    add_mesh('SV2_GlassBot', v, f, 'Crystal', a, loc=(head[0], head[1], head[2] + 0.06))
    for tag, z in (('-0.18', -0.06), ('0.3', 0.40)):
        v, f = tube([(0.13, 0.0), (0.13, 0.035)], 6, phase=math.pi / 6)
        add_mesh(f'SV2_GlassCap{tag}', v, f, 'Trim', a, loc=(head[0], head[1], head[2] + z))
    for i in range(3):
        ang = (i / 3) * math.tau
        v, f = box(0.028, 0.028, 0.46)
        add_mesh(f'SV2_GlassBar{i}', v, f, 'Trim', a,
                 loc=(head[0] + math.cos(ang) * 0.125, head[1] + math.sin(ang) * 0.125, head[2] + 0.17))


# ---------------------------------------------------------------- export

def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.users_collection and COLL in obj.users_collection)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )


def preview(out_dir, hat='Pointy', staff='Crystal'):
    """Renders the built wizard from the front and three-quarters, for checking the silhouette."""
    for obj in COLL.objects:
        if obj.name.startswith('Hat_'):
            for child in obj.children_recursive:
                child.hide_render = obj.name != f'Hat_{hat}'
        if obj.name.startswith('Staff_'):
            for child in obj.children_recursive:
                child.hide_render = obj.name != f'Staff_{staff}'

    for other in bpy.data.collections:
        if other is not COLL:
            for obj in other.objects:
                obj.hide_render = True

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in \
        {i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items} else 'BLENDER_WORKBENCH'
    scene.render.resolution_x, scene.render.resolution_y = 520, 760
    scene.render.film_transparent = False
    world = bpy.data.worlds.get('PreviewWorld') or bpy.data.worlds.new('PreviewWorld')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.04, 0.14, 1)
    scene.world = world

    for name, loc, energy in (('K', (3, -4, 5), 900), ('F', (-4, -3, 2), 350), ('R', (0, 5, 3), 300)):
        light = bpy.data.objects.new(f'PrevLight{name}', bpy.data.lights.new(f'PrevLight{name}', 'POINT'))
        light.data.energy = energy
        light.location = loc
        COLL.objects.link(light)

    cam_data = bpy.data.cameras.new('PrevCam')
    cam_data.lens = 60
    cam = bpy.data.objects.new('PrevCam', cam_data)
    COLL.objects.link(cam)
    scene.camera = cam

    os.makedirs(out_dir, exist_ok=True)
    for tag, ang in (('front', 0.0), ('three-quarter', 0.85), ('back', math.pi)):
        d, h, aim = 7.6, 2.6, 1.45
        cam.location = (math.sin(ang) * d, -math.cos(ang) * d, h)
        cam.rotation_euler = Euler((math.pi / 2 - math.atan2(h - aim, d), 0, ang))
        scene.render.filepath = os.path.join(out_dir, f'wizard-{tag}.png')
        bpy.ops.render.render(write_still=True)
    print('PREVIEW_OK ' + out_dir)


def main():
    global COLL
    COLL = fresh_collection()
    build()
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if '--preview' in argv:
        preview(argv[argv.index('--preview') + 1])
        return
    export(os.path.join(here, 'app', 'src', 'assets', 'models', 'wizard.glb'))
    if '--no-save' not in argv:
        bpy.ops.wm.save_mainfile()
    print('WIZARD_OK objects=%d' % len(COLL.objects))


main()
