"""Fail-fast validation for the canonical Blender source scene."""

from __future__ import annotations

import re

import bpy


REQUIRED = {"AccordionRoot", "Body_Left", "Body_Right", "BellowsRoot", "InteractionAnchors"}
errors: list[str] = []

missing = REQUIRED - set(bpy.data.objects.keys())
if missing:
    errors.append(f"Missing required nodes: {', '.join(sorted(missing))}")

melody = [obj for obj in bpy.data.objects if obj.name.startswith("MelodyButton_")]
bass = [obj for obj in bpy.data.objects if obj.name.startswith("BassButton_")]
if len(melody) != 21:
    errors.append(f"Expected 21 melody controls, found {len(melody)}")
if len(bass) != 8:
    errors.append(f"Expected 8 bass controls, found {len(bass)}")

for obj in [*melody, *bass]:
    for key in ("buttonId", "interactionType", "pressAxis", "pressDepth"):
        if key not in obj:
            errors.append(f"{obj.name} is missing {key}")

for obj in bpy.data.objects:
    if re.search(r"(?<![0-9+-])\.\d{3}$", obj.name):
        errors.append(f"Unstable Blender auto-suffix: {obj.name}")
    if any(value < 0 for value in obj.scale):
        errors.append(f"Negative scale on {obj.name}: {tuple(obj.scale)}")
    if obj.type == "MESH" and not obj.data.uv_layers:
        errors.append(f"Mesh has no UV map: {obj.name}")

if errors:
    raise RuntimeError("Scene validation failed:\n- " + "\n- ".join(errors))
print("Scene contract valid: 21 melody controls, 8 bass controls, stable hierarchy and UVs.")
