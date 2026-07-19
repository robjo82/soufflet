"""Create the canonical web asset from the current Club Modell I Blender scene.

Run from Blender with the source scene open. The source file is never overwritten:
the script first saves a repository-owned copy, then normalizes and exports that copy.
"""

from __future__ import annotations

import json
import math
import os
import re

import bpy


REPOSITORY = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLEND_PATH = os.path.join(REPOSITORY, "blender", "accordion-club-i.blend")
GLB_PATH = os.path.join(REPOSITORY, "public", "models", "hohner-club-i.glb")
MANIFEST_PATH = os.path.join(REPOSITORY, "public", "models", "hohner-club-i.manifest.json")
SOURCE_COLLECTION = "Hohner_Club_Modell_I"
SOURCE_ROOT = "Hohner_Club_Modell_I_ROOT"


def descendants(collection: bpy.types.Collection) -> set[bpy.types.Object]:
    objects = set(collection.objects)
    for child in collection.children:
        objects |= descendants(child)
    return objects


def preserve_parent(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def set_vector_property(obj: bpy.types.Object, key: str, values) -> None:
    obj[key] = [round(float(value), 7) for value in values]


def rename_button(
    source_name: str,
    node_name: str,
    button_id: str,
    hand: str,
    role: str,
) -> dict:
    obj = bpy.data.objects.get(source_name)
    if obj is None:
        raise RuntimeError(f"Missing interactive control: {source_name}")
    obj.name = node_name
    obj["interactionType"] = "momentary-button"
    obj["buttonId"] = button_id
    obj["hand"] = hand
    obj["role"] = role
    obj["pressAxis"] = [0.0, 1.0, 0.0]
    obj["pressDepth"] = float(obj.get("travel_m", 0.004))
    return {"id": button_id, "node": node_name, "role": role}


def smart_uv(obj: bpy.types.Object) -> None:
    if obj.type != "MESH" or len(obj.data.uv_layers):
        return
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def configure_book_motion(root: bpy.types.Object, closed_frame: int, open_frame: int) -> None:
    """Give the historical instrument a restrained, symmetric book-like opening."""
    values = {
        "bellows_yaw": (0.0, 0.82),
        "bellows_pitch": (0.0, 0.14),
        "bellows_twist": (0.0, 0.10),
    }
    for property_name, (closed_value, open_value) in values.items():
        root[property_name] = closed_value
        root.keyframe_insert(data_path=f'["{property_name}"]', frame=closed_frame)
        root[property_name] = open_value
        root.keyframe_insert(data_path=f'["{property_name}"]', frame=open_frame)
    root["bellows_motion_style"] = "book-fan: symmetric yaw with restrained pitch and twist"


def configure_web_materials() -> None:
    """Bake readable walnut grain and darken the folds for the glTF renderer."""
    width = height = 512
    image = bpy.data.images.get("CI_Wood_Grain_Web") or bpy.data.images.new(
        "CI_Wood_Grain_Web", width=width, height=height, alpha=True
    )
    if image.size[0] != width or image.size[1] != height:
        image.scale(width, height)
    pixels = [0.0] * (width * height * 4)
    for y in range(height):
        vertical = y / (height - 1)
        for x in range(width):
            horizontal = x / (width - 1)
            grain = (
                math.sin(horizontal * 94 + math.sin(vertical * 8) * 3.2) * 0.5
                + math.sin(horizontal * 227 + vertical * 19) * 0.23
                + math.sin(horizontal * 41 - vertical * 37) * 0.14
            )
            knot = math.exp(-(((horizontal - 0.32) / 0.10) ** 2 + ((vertical - 0.63) / 0.18) ** 2))
            streak = 0.62 + grain * 0.16 - knot * 0.19
            index = (y * width + x) * 4
            pixels[index:index + 4] = (
                max(0.055, streak * 0.48),
                max(0.018, streak * 0.20),
                max(0.010, streak * 0.095),
                1.0,
            )
    image.pixels.foreach_set(pixels)
    image.update()
    image.pack()

    for material_name in ("CI_Wood_Red_Mahogany", "CI_Wood_Dark_Stained"):
        material = bpy.data.materials.get(material_name)
        if material is None:
            continue
        material.use_nodes = True
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        shader = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
        if shader is None:
            continue
        texture = nodes.get("CI_Web_Wood_Texture") or nodes.new("ShaderNodeTexImage")
        texture.name = "CI_Web_Wood_Texture"
        texture.label = "Packed walnut grain for web export"
        texture.image = image
        for link in list(shader.inputs["Base Color"].links):
            links.remove(link)
        links.new(texture.outputs["Color"], shader.inputs["Base Color"])
        shader.inputs["Roughness"].default_value = 0.44
        if shader.inputs.get("Coat Weight"):
            shader.inputs["Coat Weight"].default_value = 0.12
        if shader.inputs.get("Coat Roughness"):
            shader.inputs["Coat Roughness"].default_value = 0.26

    bellows = {
        "CI_Bellows_Aged_Paper": ((0.010, 0.006, 0.003, 1.0), 0.82),
        "CI_Bellows_Black_Cloth": ((0.0015, 0.0012, 0.0010, 1.0), 0.86),
    }
    for material_name, (color, roughness) in bellows.items():
        material = bpy.data.materials.get(material_name)
        if material is None or not material.use_nodes:
            continue
        shader = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if shader is not None:
            shader.inputs["Base Color"].default_value = color
            shader.inputs["Roughness"].default_value = roughness


def normalize() -> dict:
    source_collection = bpy.data.collections.get(SOURCE_COLLECTION)
    source_root = bpy.data.objects.get(SOURCE_ROOT)
    if source_collection is None or source_root is None:
        raise RuntimeError("Open the Hohner Club Modell I source scene before running this script.")

    os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    studio_collections = [child for child in source_collection.children if child.name.startswith("08_Studio")]
    studio_objects: set[bpy.types.Object] = set()
    for collection in studio_collections:
        studio_objects |= descendants(collection)
    asset_objects = descendants(source_collection) - studio_objects

    # The canonical blend contains only the web asset, never legacy iterations or studio lights.
    for obj in list(bpy.data.objects):
        if obj not in asset_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    for collection in studio_collections:
        bpy.data.collections.remove(collection)

    root = bpy.data.objects.get(SOURCE_ROOT)
    if root is None:
        raise RuntimeError("The source root disappeared while cleaning the scene.")
    root.name = "AccordionRoot"
    root["assetId"] = "hohner-club-i-cf-10-9-2"
    root["contractVersion"] = "1.0.0"
    root["coordinateSystem"] = "Blender Z-up, glTF Y-up"
    root["unit"] = "meter"
    configure_web_materials()

    body_left = bpy.data.objects.get("CTRL_Bass_End")
    body_right = bpy.data.objects.get("CTRL_Treble_End")
    if body_left is None or body_right is None:
        raise RuntimeError("Missing body end controls.")
    body_left.name = "Body_Left"
    body_right.name = "Body_Right"
    body_left["hand"] = "left"
    body_right["hand"] = "right"

    bellows_root = bpy.data.objects.new("BellowsRoot", None)
    source_collection.objects.link(bellows_root)
    bellows_root.parent = root
    bellows_root["interactionType"] = "continuous-bellows"
    bellows_root["minimum"] = 0.0
    bellows_root["maximum"] = 1.0

    folds = []
    for index in range(18):
        fold = bpy.data.objects.get(f"CTRL_Bellows_Fold_{index:02d}")
        if fold is None:
            raise RuntimeError(f"Missing bellows fold {index:02d}")
        preserve_parent(fold, bellows_root)
        fold.name = f"BellowsFold_{index + 1:02d}"
        fold["bellowsRole"] = "fold"
        folds.append(fold)

    melody = []
    for index in range(1, 11):
        melody.append(rename_button(
            f"Treble_Button_Row_A_{index:02d}_CTRL",
            f"MelodyButton_R1_{index:02d}",
            f"c1-out-{index}",
            "right",
            "melody",
        ))
    for index in range(1, 10):
        melody.append(rename_button(
            f"Treble_Button_Row_B_{index:02d}_CTRL",
            f"MelodyButton_R2_{index:02d}",
            f"c1-in-{index}",
            "right",
            "melody",
        ))
    for index in range(1, 3):
        melody.append(rename_button(
            f"Treble_Button_Accidental_{index:02d}_CTRL",
            f"MelodyButton_R3_{index:02d}",
            f"c1-help-{index}",
            "right",
            "accidental",
        ))

    bass = []
    for pair in range(1, 5):
        bass.append(rename_button(
            f"Bass_Button_{pair}_1_CTRL",
            f"BassButton_B{pair}",
            f"bass-{pair}",
            "left",
            "bass",
        ))
        bass.append(rename_button(
            f"Bass_Button_{pair}_2_CTRL",
            f"BassButton_C{pair}",
            f"chord-{pair}",
            "left",
            "chord",
        ))

    anchors = bpy.data.objects.new("InteractionAnchors", None)
    source_collection.objects.link(anchors)
    anchors.parent = root
    anchors["purpose"] = "Reserved stable root for future hand and camera anchors"

    motion_nodes = [body_left, body_right, *folds]
    scene = bpy.context.scene
    bellows_frames = []
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        bellows_frames.append((float(root["bellows_open"]), frame))
    closed_frame = min(bellows_frames)[1]
    open_frame = max(bellows_frames)[1]
    configure_book_motion(root, closed_frame, open_frame)
    scene.frame_set(closed_frame)
    for obj in motion_nodes:
        set_vector_property(obj, "closedPosition", obj.location)
        set_vector_property(obj, "closedRotation", obj.rotation_euler)
    scene.frame_set(open_frame)
    for obj in motion_nodes:
        set_vector_property(obj, "openPosition", obj.location)
        set_vector_property(obj, "openRotation", obj.rotation_euler)
    scene.frame_set(closed_frame)

    for obj in list(asset_objects):
        if any(value < 0 for value in obj.scale):
            bpy.ops.object.select_all(action="DESELECT")
            obj.hide_set(False)
            obj.hide_viewport = False
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        smart_uv(obj)

    for obj in bpy.data.objects:
        if re.search(r"HOHNER_H_(Cream|Red)\.001$", obj.name):
            obj.name = obj.name.replace(".001", "_Alternate")

    manifest = {
        "assetId": "hohner-club-i-cf-10-9-2",
        "contractVersion": "1.0.0",
        "model": "/models/hohner-club-i.glb",
        "source": "blender/accordion-club-i.blend",
        "rootNode": "AccordionRoot",
        "bodyNodes": {"left": "Body_Left", "right": "Body_Right"},
        "bellows": {
            "root": "BellowsRoot",
            "folds": [fold.name for fold in folds],
            "minimum": 0,
            "maximum": 1,
            "motionStyle": "book-fan",
        },
        "melodyButtons": melody,
        "bassButtons": bass,
        "performanceBudget": {"maximumBytes": 5_000_000, "maximumTriangles": 150_000},
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    bpy.ops.object.select_all(action="DESELECT")
    export_objects = descendants(source_collection)
    for obj in export_objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_animations=False,
        export_apply=True,
        export_yup=True,
    )
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    return {"blend": BLEND_PATH, "glb": GLB_PATH, "manifest": MANIFEST_PATH, "objects": len(export_objects)}


RESULT = normalize()
