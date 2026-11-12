"""Constructor de criaturas originales de LAST HOUSE en Blender (bpy, sin interfaz).

Cada criatura se describe como un esqueleto de nodos (posición + grosor). El modificador Skin convierte ese
esqueleto en un cuerpo orgánico, Subdivision lo suaviza y Blender crea el armature con los pesos. Los accesorios
(ojos, corona, ropa) se pegan a un hueso. Todo se dibuja aquí: no se copia ningún modelo.
"""
import math
import os
import bpy
import bmesh
from mathutils import Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb, rough=0.75, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(rgb), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def srgb(hexrgb):
    """'#7A5C8E' -> color lineal."""
    h = hexrgb.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def body(name, nodes, subdiv=2):
    """nodes: lista de (nombre, (x, y, z), radio, padre). Devuelve (malla, armature)."""
    idx = {n[0]: i for i, n in enumerate(nodes)}
    me = bpy.data.meshes.new(name)
    me.from_pydata([n[1] for n in nodes], [(idx[n[3]], i) for i, n in enumerate(nodes) if n[3]], [])
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    sk = ob.modifiers.new('Skin', 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = 0.6
    for i, n in enumerate(nodes):
        r = n[2] if isinstance(n[2], tuple) else (n[2], n[2])
        me.skin_vertices[0].data[i].radius = r
    me.skin_vertices[0].data[0].use_root = True
    sd = ob.modifiers.new('Subd', 'SUBSURF')
    sd.levels = sd.render_levels = subdiv
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

    # armature propio: un hueso por nodo (del padre al nodo); el Z local mira hacia delante (-Y) para que
    # girar en X sea siempre «inclinar adelante/atrás» y en Z «girar a los lados»
    ad = bpy.data.armatures.new(f'{name}_Rig')
    arm = bpy.data.objects.new(f'{name}_Rig', ad)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    pos = {n[0]: Vector(n[1]) for n in nodes}
    eb = {}
    for n in nodes:
        b = ad.edit_bones.new(n[0])
        if n[3]:
            b.head, b.tail = pos[n[3]], pos[n[0]]
        else:  # raíz: hueso corto hacia arriba desde el suelo
            b.head, b.tail = Vector((pos[n[0]].x, pos[n[0]].y, 0)), pos[n[0]]
        if (b.tail - b.head).length < 1e-3:
            b.tail = b.head + Vector((0, 0, 0.05))
        b.align_roll(Vector((0, -1, 0)) if abs((b.tail - b.head).normalized().y) < 0.9 else Vector((0, 0, 1)))
        eb[n[0]] = b
    for n in nodes:
        if n[3]:
            eb[n[0]].parent = eb[n[3]]
            eb[n[0]].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    # pesos automáticos (calor) del cuerpo al armature
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return ob, arm


def paint_by(ob, rules, default):
    """Asigna materiales por cara según su vertex group dominante. rules: {hueso: material}."""
    slots = [default] + [m for m in dict.fromkeys(rules.values()) if m is not default]
    for m in slots:
        ob.data.materials.append(m)
    index = {m.name: i for i, m in enumerate(slots)}
    gname = {g.index: g.name for g in ob.vertex_groups}
    best = []
    for v in ob.data.vertices:
        top = max(v.groups, key=lambda g: g.weight, default=None)
        best.append(gname.get(top.group) if top else None)
    for p in ob.data.polygons:
        names = [best[i] for i in p.vertices]
        dom = max(set(names), key=names.count)
        m = rules.get(dom, default)
        p.material_index = index[m.name]


def attach(obj, arm, bone):
    """Pega un accesorio a un hueso sin moverlo (queda rígido, como una pieza)."""
    bpy.context.view_layer.update()  # matrix_world queda viejo si se acaba de cambiar la escala
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    obj.matrix_world = mw


def sheet(path, arm, clips, cols=4, **kw):
    """Hoja de contactos: varios fotogramas de varias acciones en una sola imagen (para revisar poses)."""
    import numpy as np
    from PIL import Image
    tiles = []
    for clip, frames in clips:
        arm.animation_data.action = bpy.data.actions[clip]
        for f in frames:
            bpy.context.scene.frame_set(f)
            p = path.replace('.png', f'_{clip}_{f}.png')
            render_only(p, **kw)
            tiles.append(Image.open(p).convert('RGB'))
            os.remove(p)
    w, h = tiles[0].size
    rows = (len(tiles) + cols - 1) // cols
    out = Image.new('RGB', (w * cols, h * rows))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * w, (i // cols) * h))
    out.save(path)


def sphere(name, loc, r, m, scale=(1, 1, 1), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


def key(arm, bone, frame, rot=None, loc=None, scale=None):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    if scale is not None:
        pb.scale = scale
        pb.keyframe_insert('scale', frame=frame)
    if rot is not None:
        pb.rotation_euler = [math.radians(a) for a in rot]
        pb.keyframe_insert('rotation_euler', frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert('location', frame=frame)


def action(arm, name, frames, poses, loop=True):
    """poses: {frame: {hueso: (rot, loc)}}. Crea una acción con nombre (clip en Unity)."""
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    for f, bones in poses.items():
        for bone, v in bones.items():
            key(arm, bone, f, *v)
    act.frame_range = (1, frames)
    if loop:
        for fc in _fcurves(act):
            fc.modifiers.new('CYCLES')
    arm.animation_data.action = None
    return act


def _fcurves(act):
    if hasattr(act, 'fcurves'):
        return act.fcurves
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def render_only(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def stage(target=(0, 0, 1), dist=4.5, height=1.6, res=(720, 900), samples=48):
    """Escenario de prueba: atardecer cálido, luz de contorno fría, césped y cámara."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new('W')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (*srgb('#F2B880'), 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
    bpy.ops.mesh.primitive_plane_add(size=30)
    bpy.context.active_object.data.materials.append(mat('Cesped', '#4FB548', 0.9))
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(35)))
    bpy.context.active_object.data.energy = 3.2
    bpy.context.active_object.data.color = (1.0, 0.86, 0.7)
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(-60), 0, math.radians(200)))
    bpy.context.active_object.data.energy = 1.4
    bpy.context.active_object.data.color = (0.6, 0.7, 1.0)
    t = Vector(target)
    bpy.ops.object.camera_add(location=(t.x + dist * 0.55, t.y - dist, t.z + height - 1))
    cam = bpy.context.active_object
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 50
    sc.camera = cam


def export_fbx(path, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.fbx(filepath=path, use_selection=True, add_leaf_bones=False, bake_anim=True,
                             bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
                             apply_scale_options='FBX_SCALE_ALL', axis_forward='-Z', axis_up='Y',
                             mesh_smooth_type='FACE')


def rig(name, bones):
    """Armature simple para criaturas rígidas por piezas. bones: (nombre, cabeza, cola, padre)."""
    ad = bpy.data.armatures.new(f'{name}_Rig')
    arm = bpy.data.objects.new(f'{name}_Rig', ad)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n, h, t, par in bones:
        b = ad.edit_bones.new(n)
        b.head, b.tail = Vector(h), Vector(t)
        b.align_roll(Vector((0, -1, 0)))
        if par:
            b.parent = eb[par]
        eb[n] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def prim(kind, name, m, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), **kw):
    getattr(bpy.ops.mesh, f'primitive_{kind}_add')(location=loc, rotation=[math.radians(a) for a in rot], **kw)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.data.materials.append(m)
    if kind in ('uv_sphere', 'cylinder', 'cone', 'torus'):
        bpy.ops.object.shade_smooth()
    return o


def smooth(o, levels=2):
    sd = o.modifiers.new('Subd', 'SUBSURF')
    sd.levels = sd.render_levels = levels
    return o
