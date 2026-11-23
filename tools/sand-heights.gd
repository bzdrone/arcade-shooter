# Author-only: sample the MP_Portal_Sand terrain height on a regular grid for the
# Arcade-to-Portal level converter (site/converter/sand-heights.js). Run with the
# Godot editor bundled in the Portal SDK, from the SDK folder:
#
#   ./Godot_v4.6.3-stable_win64.exe --headless --path GodotProject \
#       --script <this repo>/tools/sand-heights.gd -- <output.json>
#
# Reads the SDK's imported terrain mesh; changes nothing in the SDK.
extends SceneTree

const HALF := 100.0   # metres either side of the map origin
const STEP := 4.0     # grid spacing in metres
const CELL := 8.0     # triangle bucket size

var buckets := {}

func _key(x: float, z: float) -> Vector2i:
	return Vector2i(floori(x / CELL), floori(z / CELL))

func _collect(n: Node, xf: Transform3D) -> void:
	var t := xf
	if n is Node3D: t = xf * (n as Node3D).transform
	if n is MeshInstance3D and (n as MeshInstance3D).mesh:
		var f: PackedVector3Array = (n as MeshInstance3D).mesh.get_faces()
		for i in range(0, f.size(), 3):
			var a := t * f[i]; var b := t * f[i + 1]; var c := t * f[i + 2]
			var lo := Vector2(min(a.x, b.x, c.x), min(a.z, b.z, c.z))
			var hi := Vector2(max(a.x, b.x, c.x), max(a.z, b.z, c.z))
			if hi.x < -HALF - CELL or lo.x > HALF + CELL or hi.y < -HALF - CELL or lo.y > HALF + CELL: continue
			var k0 := _key(lo.x, lo.y); var k1 := _key(hi.x, hi.y)
			for kx in range(k0.x, k1.x + 1):
				for kz in range(k0.y, k1.y + 1):
					var k := Vector2i(kx, kz)
					if not buckets.has(k): buckets[k] = []
					buckets[k].append([a, b, c])
	for c in n.get_children(): _collect(c, t)

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var scene: PackedScene = load("res://static/MP_Portal_Sand_Terrain.tscn")
	_collect(scene.instantiate(), Transform3D.IDENTITY)
	var count := int(HALF * 2 / STEP) + 1
	var heights := []
	for zi in range(count):
		for xi in range(count):
			var x := -HALF + xi * STEP; var z := -HALF + zi * STEP
			var h := -1000.0
			for tr in buckets.get(_key(x, z), []):
				var r = Geometry3D.ray_intersects_triangle(Vector3(x, 1000, z), Vector3.DOWN, tr[0], tr[1], tr[2])
				if r != null: h = max(h, r.y)
			heights.append(snappedf(h, 0.01))
	var out := JSON.stringify({ "level": "MP_Portal_Sand", "origin": -HALF, "step": STEP, "count": count, "heights": heights })
	if args.size() > 0:
		var file := FileAccess.open(args[0], FileAccess.WRITE)
		file.store_string(out)
	else:
		print(out)
	quit()
