"""Add lightweight facial shape keys to the static Meshy pirate GLB.

Run with:
  blender --background --python scripts/blender/build-pirate-expressions.py -- input.glb output.glb
"""

import sys
from pathlib import Path

import bpy


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def smooth(value):
    value = clamp(value)
    return value * value * (3.0 - 2.0 * value)


def bell(value, center, radius):
    return smooth(1.0 - abs(value - center) / radius)


def face_surface_weight(co):
    front_limit = smooth((co.y + 0.035) / 0.030)
    back_limit = smooth((0.110 - co.y) / 0.045)
    return front_limit * back_limit


def eye_weight(co):
    left = bell(co.x, -0.042, 0.036)
    right = bell(co.x, 0.042, 0.036)
    return max(left, right) * bell(co.z, 1.574, 0.023) * face_surface_weight(co)


def brow_weight(co):
    left = bell(co.x, -0.047, 0.047)
    right = bell(co.x, 0.047, 0.047)
    return max(left, right) * bell(co.z, 1.602, 0.021) * face_surface_weight(co)


def build_expressions(pirate):
    pirate.name = "PirateCaptainExpressive"
    pirate.data.name = "PirateCaptainExpressiveMesh"

    pirate.shape_key_add(name="Basis")
    blink = pirate.shape_key_add(name="Blink")
    worried = pirate.shape_key_add(name="Worried")
    surprised = pirate.shape_key_add(name="Surprised")

    for index, vertex in enumerate(pirate.data.vertices):
        co = vertex.co
        eye = eye_weight(co)
        brow = brow_weight(co)

        if eye > 0.0:
            blink.data[index].co.z += (1.574 - co.z) * 0.92 * eye
            surprised.data[index].co.y -= 0.0005 * eye

        if brow > 0.0:
            inner = smooth((0.080 - abs(co.x)) / 0.060)
            worried.data[index].co.z += (-0.008 + inner * 0.036) * brow
            worried.data[index].co.y -= 0.006 * brow
            surprised.data[index].co.z += 0.016 * brow
            surprised.data[index].co.y -= 0.003 * brow

        jaw = bell(co.x, 0.0, 0.145) * bell(co.z, 1.470, 0.085) * face_surface_weight(co)
        if jaw > 0.0:
            surprised.data[index].co.z -= 0.020 * jaw
            surprised.data[index].co.y -= 0.006 * jaw

    for key in (blink, worried, surprised):
        key.value = 0.0
        key.slider_min = 0.0
        key.slider_max = 1.0


def main():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(args) != 2:
        raise SystemExit("Expected input and output GLB paths after --")

    source = Path(args[0]).expanduser().resolve()
    destination = Path(args[1]).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))
    pirate = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    build_expressions(pirate)

    bpy.ops.object.select_all(action="DESELECT")
    pirate.select_set(True)
    bpy.context.view_layer.objects.active = pirate
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        use_selection=True,
        export_morph=True,
        export_morph_normal=False,
        export_morph_tangent=False,
    )
    print(f"Expressive pirate written to {destination}")


if __name__ == "__main__":
    main()
