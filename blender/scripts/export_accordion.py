"""Re-export the canonical Club I GLB without changing the scene contract."""

from __future__ import annotations

import os

import bpy


REPOSITORY = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT = os.path.join(REPOSITORY, "public", "models", "hohner-club-i.glb")


def descendants(collection: bpy.types.Collection) -> set[bpy.types.Object]:
    objects = set(collection.objects)
    for child in collection.children:
        objects |= descendants(child)
    return objects


root = bpy.data.objects.get("AccordionRoot")
collection = bpy.data.collections.get("Hohner_Club_Modell_I")
if root is None or collection is None:
    raise RuntimeError("This is not the normalized Soufflet Club I scene.")

bpy.ops.object.select_all(action="DESELECT")
for obj in descendants(collection):
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.hide_render = False
    obj.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(
    filepath=OUTPUT,
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_animations=False,
    export_apply=True,
    export_yup=True,
)
print(f"Exported {OUTPUT}")
