# OMM (Open Match Model)

**OMM** is a ultra-lightweight 3D model format and autonomous engine in pure JavaScript. Created for quick integration of 3D graphics into web projects without using heavy libraries (Zero Dependencies).

## 🚀 Quick Start

1. Place `omm-core.js` in your project folder.
2. Link the script at the end of your HTML:
   ```html
   <script src="omm-core.js"></script>
   ```
3. Use the model tag:
   ```html
   <omm-model src="my_model.omm" autorate></omm-model>
   ```

---

## 📝 Syntax and features of .omm

A `.omm` file is a text document. Each new shape starts with a keyword.

### 1. Geometry
* `cube3` — standard cube.
* `cube3 : 4` — slab (height reduced by 4 times). The number after `:` determines the object's thickness.
* `image3` — flat surface (billboard) in 3D space. Perfect for icons or grass.

### 2. Transformations
Parameters are written under the shape or on one line:
* `x(n) y(n) z(n)` — position. In OMM `y` goes upward (negative values raise the object).
* `scale(n)` — scaling. Default face size is 50px.
* `rr(deg)` — rotate right (around Y axis).
* `ru(deg)` — rotate up (around X axis).

### 3. Visualization and Textures
* `color(R, G, B)` — fill color (for example, `color(0, 255, 100)`).


* **Textures**: The `texture(...)` command replaces color with an image. You can use external links like `texture(https://site.com/img.png)` or local Base64-encoded images that the Studio editor automatically generates when you load an image: `texture(data:image/png;base64,iVBOR...)`. The texture applies to all cube faces automatically.

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

CORS restrictions may block `.omm` file loading when working locally (`file://`), so use a local server instead. Base64 encoding increases file size but enables models to function independently without external image