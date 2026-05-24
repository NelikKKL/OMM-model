# OMM (Open Match Model)

**OMM** is an ultra-lightweight 3D model format and autonomous engine in pure JavaScript. Created for quick integration of 3D graphics into web projects without using heavy libraries (Zero Dependencies).

## 📦 Installation

### CDN (Script tag)
```html
<script src="https://cdn.jsdelivr.net/gh/NelikKKL/OMM-model@v2.0.0/dist/omm-core.min.js"></script>
```

### CDN (ESM)
```js
import 'https://cdn.jsdelivr.net/gh/NelikKKL/OMM-model@v2.0.0/dist/omm-core.esm.js';
```

### Local
Download `omm-core.js` from [Releases](https://github.com/NelikKKL/OMM-model/releases) and include it:
```html
<script src="omm-core.js"></script>
```

## 🚀 Quick Start

Include the library and use the model tag:
```html
<omm-model src="my_model.omm" autorate></omm-model>
```

### <omm-model>
Attributes can be added to the tag: `<omm-model src="model.omm" here`

Available attributes:
`autorate` - model spins automatically
`freer` - full free rotation and zoom

---

## 📝 Syntax and features of .omm

A `.omm` file is a text document. Each new shape starts with a keyword.

### 1. Geometry
* `cube3` — standard cube.
* `cube3 : 4` — slab (height reduced by 4 times). The number after `:` determines the object's thickness.
* `pyramid3` — pyramid.
* `sphere3` — sphere.
* `cylinder3` — cylinder.
* `triangle3` — flat triangle.
* `image3` — flat surface (billboard) in 3D space. Perfect for icons or grass.

***Combining multiple shapes into one***

```
mono( 
cube3
color(150, 150, 150)
y(200)
sphere3
color(150, 150, 150)
)
```

It will be treated as a single model — animations will rotate both shapes together as one.

### 2. Transformations
Parameters are written under the shape or on one line:
* `x(n) y(n) z(n)` — position. In OMM `y` goes upward (negative values raise the object).
* `scale(n)` — scaling. Default face size is 50px.
* `rr(deg)` — rotate right (around Y axis).
* `ru(deg)` — rotate up (around X axis).

### 3. Animation
You can specify several keypoints:
* `animation(x0 y0 z0, x0 y200 z0)`

You can also specify only one value:
* `animation(y200 , y0)`

`rr` and other transforms can also be used in animations.

### 4. Asymmetric Stretching
Allows deforming shapes by stretching sides (works for all types except `cube3`):
* `ur(n)` — stretch right (X-axis).
* `ul(n)` — stretch left (X-axis).
* `uu(n)` — stretch up (Y-axis).
* `ud(n)` — stretch down (Y-axis).
* `ug(n)` — stretch forward (Z-axis).
* `um(n)` — stretch backward (Z-axis).

### 5. Visualization and Textures
* `color(R, G, B)` — fill color (e.g. `color(0, 255, 100)`).
* **Textures**: The `texture(...)` command replaces color with an image.
    * **External link**: `texture(https://site.com/img.png)`
    * **Local (Base64)**: The Studio editor automatically encodes images when loaded:
        `texture(data:image/png;base64,iVBOR...)`
    * *Note:* The texture is applied to all shape faces automatically.

## 💡 Advanced Usage (API)

Manage models directly from HTML using `<omm-model>` tag attributes:

| Attribute | Description |
| :--- | :--- |
| `src` | Path to the `.omm` file. |
| `autorate` | If present, the model rotates infinitely. |
| `textContent` | Write model code directly inside the tag. |

**Example of inline code:**
```html
<omm-model>
  cube3
  color(255, 0, 0)
  scale(2)
</omm-model>
```

---

## ⚠️ Technical Notes
* **CORS**: Loading `.omm` files may be blocked when working locally (`file://`). Use a local server instead (VS Code Live Server, Node.js, Python).
* **Base64**: Using Base64 inside `.omm` increases file size but allows the model to work independently without external images.
