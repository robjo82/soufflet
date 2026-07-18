"""Refresh web motion metadata from the canonical scene's demonstration action."""

from __future__ import annotations

import os

import bpy


REPOSITORY = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
root = bpy.data.objects.get("AccordionRoot")
if root is None:
    raise RuntimeError("Open blender/accordion-club-i.blend before capturing motion.")

scene = bpy.context.scene
samples = []
for frame in range(scene.frame_start, scene.frame_end + 1):
    scene.frame_set(frame)
    samples.append((float(root["bellows_open"]), frame))

closed_frame = min(samples)[1]
open_frame = max(samples)[1]
nodes = [bpy.data.objects["Body_Left"], bpy.data.objects["Body_Right"]]
nodes.extend(sorted((obj for obj in bpy.data.objects if obj.name.startswith("BellowsFold_")), key=lambda obj: obj.name))

for label, frame in (("closed", closed_frame), ("open", open_frame)):
    scene.frame_set(frame)
    for obj in nodes:
        obj[f"{label}Position"] = [round(float(value), 7) for value in obj.location]
        obj[f"{label}Rotation"] = [round(float(value), 7) for value in obj.rotation_euler]

scene.frame_set(closed_frame)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
script = os.path.join(os.path.dirname(__file__), "export_accordion.py")
namespace = {"__file__": script, "__name__": "__main__"}
exec(compile(open(script, encoding="utf-8").read(), script, "exec"), namespace)
print(f"Captured bellows frames {closed_frame} → {open_frame}")
