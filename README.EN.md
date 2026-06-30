# OMM (Open Match Model)

[Читать на русском](https://github.com/NelikKKL/OMM-model/blob/main/README.md)

**OMM** is an ultra-lightweight 3D model format and autonomous engine written in **Rust** and compiled to **WebAssembly**. Designed for quick integration of 3D graphics into web projects with zero dependencies.

> **v3.0** — full rewrite in Rust/WASM. The renderer core (~30 KB `.wasm`) is compiled from safe Rust; a thin JS wrapper registers the Web Component.

## 📦 Installation

### CDN — one tag (ESM)
```html
<script type="module"
  src="https://cdn.jsdelivr.net/gh/NelikKKL/OMM-model@v3.0.0/pkg/omm-component.js">
</script>
```

`omm_core.js` and `omm_core_bg.wasm` are loaded automatically (they sit next to the component on the CDN).

### Local
Download three files from [Releases](https://github.com/NelikKKL/OMM-model/releases) into the same folder:
- `omm-component.js`
- `omm_core.js`
- `omm_core_bg.wasm`

```html
<script type="module" src="./omm-component.js"></script>
```

> ⚠️ A local HTTP server is required (Live Server, `python -m http.server`, etc.) — browsers block WASM/modules from `file://`.

## 🚀 Quick Start

```html
<!-- Auto-rotation -->
<omm-model src="model.omm" autorate></omm-model>

<!-- Full control (mouse + touch + zoom) -->
<omm-model src="model.omm" freer></omm-model>

<!-- Inline model code -->
<omm-model autorate>
  cube3
  color(80, 140, 255)
  scale(2)
</omm-model>
```

### `<omm-model>` attributes

| Attribute | Description |
| :--- | :--- |
| `src` | Path to the `.omm` file. |
| `autorate` | Infinite auto-rotation of the model. |
| `freer` | Mouse/touch rotation + pinch-zoom + panning (RMB / middle button). |

---

## 📝 `.omm` Syntax

A `.omm` file is a plain text document. Each shape starts with a keyword.

### 1. Geometry

| Keyword | Description |
| :--- | :--- |
| `cube3` | Standard cube. |
| `cube3 : 4` | Slab (height reduced by factor of 4). |
| `pyramid3` | Pyramid. |
| `sphere3` | Sphere. |
| `cylinder3` | Cylinder. |
| `triangle3` | Flat triangle. |
| `image3` | Textured billboard plane. |
| `mesh3` | Arbitrary (complex) geometry — see below. |

### 1.1. Arbitrary geometry `mesh3`

`mesh3` holds any triangle geometry — hand-authored or imported from `.glb`/`.obj`. Shading is computed per-face from its real normal (flat shading), not the index-based trick used for primitives, so complex shapes look correct from any angle.

Hand-authored:

```
mesh3
verts(0 -50 0, 50 50 0, -50 50 0, 0 -50 100)
tris(0 1 2, 0 3 1, 0 2 3, 1 3 2)
color(220, 120, 60)
```

`verts(x y z, ...)` lists vertices, `tris(i j k, ...)` lists triangle indices (0-based), and an optional `uvs(u v, ...)` adds one UV pair per vertex. All standard transforms apply (`x/y/z`, `scale`, `rr/ru`, `animation`, `mono()`) except asymmetric deform (`ur/ul/...`).

Auto-generated meshes pack geometry into compact base64 instead: `data(...)`. This is produced by the `.glb`/`.obj` importers below and isn't meant to be hand-edited.

### 1.2. Importing `.glb` and `.obj`

Just point `src` at the file — conversion to `mesh3` happens automatically in the browser:

```html
<omm-model src="model.glb" autorate></omm-model>
<omm-model src="model.obj" freer></omm-model>
```

`.glb` support bakes the full node hierarchy into vertex positions and carries over `baseColorFactor` and embedded PNG/JPEG textures (TRIANGLES mode only; skeletal animation/morph targets aren't imported; only self-contained `.glb`, not `.gltf` + external files). `.obj` support parses vertices/UVs/faces (n-gons are fan-triangulated); `.mtl` materials aren't parsed, so add `color()`/`texture()` to the result manually if needed.

To convert once and cache the result as a plain `.omm` file, call the WASM exports directly:

```js
import init, { obj_to_omm, glb_to_omm } from './omm_core.js';
await init();
const ommText = obj_to_omm(await (await fetch('chair.obj')).text());
```

### 2. Transformations

```
x(n)     y(n)     z(n)     — position (y goes up; negative values raise the object)
scale(n)                    — scale (default face size is 50 px)
rr(deg)                     — rotate right (Y-axis)
ru(deg)                     — rotate up   (X-axis)
```

### 3. Animation

```
animation(x0 y0 z0, x0 y200 z0)   — comma-separated keyframes
animation(y200, y0)                — only the axes you need
```

Supported per-keyframe fields: `x`, `y`, `z`, `rr`, `ru`.

### 4. Asymmetric Stretching

Deform shapes by stretching individual sides (all types except `cube3` and `mesh3`):

```
ur(n)  ul(n)   — right / left (X-axis)
uu(n)  ud(n)   — up    / down (Y-axis)
ug(n)  um(n)   — forward / back (Z-axis)
```

### 5. Color and Textures

```
color(R, G, B)                         — fill color, 0–255
texture(https://site.com/img.png)      — external URL
texture(data:image/png;base64,iVBOR…)  — inline Base64
```

The texture is applied to all faces of the shape automatically.

### 6. Grouping with `mono()`

Combines multiple shapes into one that is animated and transformed as a single unit:

```
mono(
  x(0) y(0) scale(1)   ← group-level transform (optional)

  cube3
  color(150, 150, 150)
  y(200)

  sphere3
  color(200, 100, 50)
)
```

---

## 💡 Full Example

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module"
    src="https://cdn.jsdelivr.net/gh/NelikKKL/OMM-model@v3.0.0/pkg/omm-component.js">
  </script>
  <style>
    omm-model { width: 400px; height: 400px; display: block; }
  </style>
</head>
<body>
  <omm-model freer>
    sphere3
    color(80, 160, 255)
    scale(2)
    animation(y-100, y100)

    cube3
    color(255, 100, 80)
    y(250)
    rr(45)
  </omm-model>
</body>
</html>
```

---

## 🔧 Building from Source

Requirements: [Rust](https://rustup.rs/) + [wasm-pack](https://rustwasm.github.io/wasm-pack/).

```bash
wasm-pack build --release --target web --out-dir pkg
cp js/omm-component.js pkg/
```

Output artifacts will appear in `pkg/`.

---

## ⚠️ Technical Notes

- **CORS**: loading `.omm` files may be blocked when serving from `file://`. Use a local HTTP server.
- **Base64**: embedding textures as Base64 increases the `.omm` file size but makes the model fully self-contained.
- **ESM only**: v3.x uses ES modules and requires `<script type="module">`. The legacy `<script src="...">` approach is not supported.
