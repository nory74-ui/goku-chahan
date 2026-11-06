import bpy
import bmesh
import math
import os
from mathutils import Vector, Euler, Matrix

OUT_DIR = "/Users/nryktnk/.gemini/antigravity/scratch/GokuChahanUnity/Assets/Models"
os.makedirs(OUT_DIR, exist_ok=True)

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def export_fbx(filename):
    filepath = os.path.join(OUT_DIR, filename)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.fbx(
        filepath=filepath,
        use_selection=True,
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_ALL',
        axis_forward='-Z',
        axis_up='Y'
    )
    print(f"Exported: {filepath}")

# ==============================================================================
# 1. プロ仕様 中華鍋 (北京鍋) のモデリング
# ==============================================================================
def create_real_wok():
    clear_scene()

    # --- 1-1. 中華鍋ボウル本体 ---
    R = 1.6
    H = 0.85
    radial_segs = 48
    height_segs = 24
    curvature = H / (R * R)

    mesh = bpy.data.meshes.new("WokBowlMesh")
    bm = bmesh.new()

    # 放物面グリッド頂点
    grid = []
    for h_idx in range(height_segs + 1):
        r_norm = h_idx / height_segs
        r = r_norm * R
        y = curvature * (r * r)
        row = []
        for s_idx in range(radial_segs):
            theta = (s_idx / radial_segs) * math.pi * 2.0
            x = math.cos(theta) * r
            z = math.sin(theta) * r
            
            # 手打ちハンマー打痕の微細な歪み（ノイズ）
            noise = (math.sin(x * 12.0) * math.cos(z * 12.0)) * 0.008
            v = bm.verts.new((x, y + noise, z))
            row.append(v)
        grid.append(row)

    # 面の構築
    for h_idx in range(height_segs):
        for s_idx in range(radial_segs):
            s_next = (s_idx + 1) % radial_segs
            v1 = grid[h_idx][s_idx]
            v2 = grid[h_idx][s_next]
            v3 = grid[h_idx + 1][s_next]
            v4 = grid[h_idx + 1][s_idx]
            bm.faces.new((v1, v2, v3, v4))

    # --- 外巻きカールした縁（ヘミングリム）の追加 ---
    rim_verts = grid[-1]
    rim_loops = 5
    rim_radius = 0.025
    prev_loop = rim_verts

    for step in range(1, rim_loops + 1):
        angle = (step / rim_loops) * math.pi * 1.5
        new_loop = []
        for s_idx in range(radial_segs):
            theta = (s_idx / radial_segs) * math.pi * 2.0
            cur_r = R + math.sin(angle) * rim_radius
            cur_y = H - (1.0 - math.cos(angle)) * rim_radius
            x = math.cos(theta) * cur_r
            z = math.sin(theta) * cur_r
            v = bm.verts.new((x, cur_y, z))
            new_loop.append(v)
            
        for s_idx in range(radial_segs):
            s_next = (s_idx + 1) % radial_segs
            v1 = prev_loop[s_idx]
            v2 = prev_loop[s_next]
            v3 = new_loop[s_next]
            v4 = new_loop[s_idx]
            bm.faces.new((v1, v2, v3, v4))
        prev_loop = new_loop

    bm.to_mesh(mesh)
    bm.free()

    wok_obj = bpy.data.objects.new("WokBowl", mesh)
    bpy.context.collection.objects.link(wok_obj)

    # 厚みモディファイア (Solidify)
    sol_mod = wok_obj.modifiers.new("Solidify", 'SOLIDIFY')
    sol_mod.thickness = 0.016
    sol_mod.offset = -1.0

    # サブディビジョンで滑らかに
    sub_mod = wok_obj.modifiers.new("Subdivision", 'SUBSURF')
    sub_mod.levels = 1
    sub_mod.render_levels = 1

    # スムースシェード
    for poly in wok_obj.data.polygons:
        poly.use_smooth = True

    # --- 1-2. リベット留め金具（ハンドルブラケット） ---
    # 鍋の外側手前（Z > 0）に頑丈な三角プレート
    bracket_mesh = bpy.data.meshes.new("BracketMesh")
    bm_b = bmesh.new()
    bmesh.ops.create_cube(bm_b, size=1.0)
    bm_b.to_mesh(bracket_mesh)
    bm_b.free()

    bracket_obj = bpy.data.objects.new("HandleBracket", bracket_mesh)
    bpy.context.collection.objects.link(bracket_obj)
    bracket_obj.scale = (0.24, 0.04, 0.18)
    bracket_obj.rotation_euler = (math.radians(-32), 0, 0)
    bracket_obj.location = (0, 0.52, R - 0.02)

    # 3本のリベット（鋲）
    rivet_objs = []
    rivet_positions = [
        (-0.06, 0.56, R - 0.03),
        (0.06, 0.56, R - 0.03),
        (0.0, 0.46, R - 0.06)
    ]
    for r_idx, r_pos in enumerate(rivet_positions):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.024, location=r_pos)
        rivet = bpy.context.active_object
        rivet.name = f"Rivet_{r_idx}"
        rivet.scale = (1.0, 0.5, 1.0)
        rivet.rotation_euler = (math.radians(-32), 0, 0)
        rivet_objs.append(rivet)

    # --- 1-3. エルゴノミック木製ハンドル ＋ 金属リング ---
    # くびれのある握りやすい木製柄
    handle_mesh = bpy.data.meshes.new("WoodHandleMesh")
    bm_h = bmesh.new()
    
    # 旋盤のように円周を押し出しながら太さを変える
    h_segs = 16
    h_length = 0.55
    steps = 14
    h_grid = []
    for step in range(steps + 1):
        t = step / steps
        y_pos = t * h_length
        # 人間工学カーブ（真ん中がくびれ、手前が太い）
        r_profile = 0.065 + math.sin(t * math.pi) * -0.015 + (1.0 - t) * 0.012
        row = []
        for s in range(h_segs):
            theta = (s / h_segs) * math.pi * 2.0
            x = math.cos(theta) * r_profile
            z = math.sin(theta) * r_profile
            v = bm_h.verts.new((x, y_pos, z))
            row.append(v)
        h_grid.append(row)

    for step in range(steps):
        for s in range(h_segs):
            s_next = (s + 1) % h_segs
            bm_h.faces.new((h_grid[step][s], h_grid[step][s_next], h_grid[step + 1][s_next], h_grid[step + 1][s]))
            
    # 端面のフタ
    bm_h.faces.new(h_grid[0])
    bm_h.faces.new(list(reversed(h_grid[-1])))

    bm_h.to_mesh(handle_mesh)
    bm_h.free()

    handle_obj = bpy.data.objects.new("WoodHandle", handle_mesh)
    bpy.context.collection.objects.link(handle_obj)
    handle_obj.rotation_euler = (math.radians(78), 0, 0)
    handle_obj.location = (0, 0.52, R + 0.12)

    # 吊り下げ用金属Oリング
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.045, minor_radius=0.008,
        major_segments=16, minor_segments=8,
        location=(0, 0.42, R + 0.68)
    )
    ring_obj = bpy.context.active_object
    ring_obj.name = "HangRing"
    ring_obj.rotation_euler = (math.radians(12), 0, 0)

    # すべてを結合して1つの洗練されたプロ中華鍋モデルにまとめる
    all_wok_parts = [wok_obj, bracket_obj, handle_obj, ring_obj] + rivet_objs
    for obj in all_wok_parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = wok_obj
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    wok_obj.name = "RealChahanWok"

    export_fbx("real_wok.fbx")

# ==============================================================================
# 2. リアル米粒 (三日月カーブ ＋ 胚芽の欠け)
# ==============================================================================
def create_real_rice():
    clear_scene()

    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.05)
    rice = bpy.context.active_object
    rice.name = "RealRice"
    rice.scale = (0.75, 0.65, 1.45) # 細長形状
    bpy.ops.object.transform_apply(scale=True)

    # 頂点を変形して三日月カーブと胚芽の削れを作る
    mesh = rice.data
    for v in mesh.vertices:
        # Z軸に沿って少し上に反らす（カーブ）
        z_norm = v.co.z / 0.07
        v.co.y += (z_norm * z_norm) * 0.012

        # 先端（Z > 0.055）の片側を斜めに削り、胚芽（はいが）の欠けを再現
        if v.co.z > 0.045 and v.co.x > 0.01:
            v.co.x *= 0.65
            v.co.z -= 0.01

    mesh.update()
    bpy.ops.object.shade_smooth()
    export_fbx("real_rice.fbx")

# ==============================================================================
# 3. リアル刻みチャーシュー (包丁で不揃いに切られた乱切り塊)
# ==============================================================================
def create_real_meat():
    clear_scene()

    bpy.ops.mesh.primitive_cube_add(size=0.12)
    meat = bpy.context.active_object
    meat.name = "RealMeat"

    # ベベルモディファイアで角を落とす
    bev = meat.modifiers.new("Bevel", 'BEVEL')
    bev.width = 0.018
    bev.segments = 2

    # 表面に肉の繊維・包丁の不揃い凹凸
    mesh = meat.data
    for v in mesh.vertices:
        v.co.x += (math.sin(v.co.y * 30.0) * math.cos(v.co.z * 30.0)) * 0.008
        v.co.y += (math.sin(v.co.x * 25.0)) * 0.006

    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.shade_smooth()
    export_fbx("real_meat.fbx")

# ==============================================================================
# 4. リアル小口切り長ネギ (中が空洞になった薄いリング構造)
# ==============================================================================
def create_real_onion():
    clear_scene()

    # 円筒（シリンダー）を作成して中をくり抜く（チューブ状）
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.055, depth=0.035, end_fill_type='NOTHING'
    )
    outer = bpy.context.active_object
    outer.name = "RealOnion"

    # Solidifyで薄いネギの肉厚を持たせる
    sol = outer.modifiers.new("Solidify", 'SOLIDIFY')
    sol.thickness = 0.009
    sol.offset = -1.0

    # 包丁で切られた時の斜めスライス感（シアー）
    bpy.ops.object.convert(target='MESH')
    mesh = outer.data
    for v in mesh.vertices:
        # わずかな楕円潰れ ＋ 斜めスライス
        v.co.x *= 1.15
        v.co.y += v.co.x * 0.25 # 斜め切り

    mesh.update()
    bpy.ops.object.shade_smooth()
    export_fbx("real_onion.fbx")

# ==============================================================================
# 5. ふんわり炒り卵 (スクランブル状のそぼろ塊)
# ==============================================================================
def create_real_egg():
    clear_scene()

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.065)
    egg = bpy.context.active_object
    egg.name = "RealEgg"

    # ボロノイ風の強い有機的変形（炒り卵のちぢれ）
    mesh = egg.data
    for v in mesh.vertices:
        distort = (math.sin(v.co.x * 35.0) * math.cos(v.co.y * 35.0) * math.sin(v.co.z * 35.0))
        v.co += v.normal * distort * 0.022
        # 平べったく潰れたそぼろ
        v.co.y *= 0.65

    mesh.update()
    bpy.ops.object.shade_smooth()
    export_fbx("real_egg.fbx")

# 実行
if __name__ == "__main__":
    print("=== Generating High-End Realistic Assets via Blender 5.2 ===")
    create_real_wok()
    create_real_rice()
    create_real_meat()
    create_real_onion()
    create_real_egg()
    print("=== All Realistic Assets Exported to Assets/Models! ===")
