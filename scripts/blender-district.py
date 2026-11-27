"""Run in background Blender from the project root after node scripts/export-district.mjs."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

folder = Path(__file__).resolve().parents[1] / "blender"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(folder / "Centar.glb"))
scene = bpy.context.scene
for name in ("Hamzibegova džamija", "Gradski most", "Sana", "Cvijet Srebrenice"):
    assert bpy.data.objects.get(name), name
scene.unit_settings.system = "METRIC"
scene["Izvori"] = "© OpenStreetMap contributors (ODbL); Copernicus DEM GLO-30; modified Copernicus Sentinel data 2026. Izvori modela: public/data/landmarks-sources.txt."
scene.world = bpy.data.worlds.new("Nebo")
scene.world.color = (.45, .49, .54)
target = Vector((-160, -247, 5))
camera_data = bpy.data.cameras.new("Pregled centra")
camera = bpy.data.objects.new("Pregled centra", camera_data)
scene.collection.objects.link(camera)
camera.location = target + Vector((260, -170, 245))
rotation = (target - camera.location).to_track_quat("-Z", "Y")
camera.rotation_euler = rotation.to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 433
camera_data.clip_end = 2000
scene.camera = camera
sun_data = bpy.data.lights.new("Dnevno svjetlo", "SUN")
sun_data.energy = 3
sun_data.angle = math.radians(10)
sun = bpy.data.objects.new("Dnevno svjetlo", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(30), math.radians(-22), math.radians(12))
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            view = area.spaces.active
            view.region_3d.view_rotation = rotation
            view.region_3d.view_distance = 390
            view.region_3d.view_location = target
            view.clip_end = 2500
            view.shading.type = "MATERIAL"
            view.overlay.show_overlays = False
bpy.ops.object.select_all(action="DESELECT")
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
scene.render.engine = "CYCLES"
scene.cycles.samples = 5
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.filepath = "//Centar.png"
bpy.ops.wm.save_as_mainfile(filepath=str(folder / "Centar.blend"))
bpy.ops.render.render(write_still=True)
