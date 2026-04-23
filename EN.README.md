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

---

## 🛠 Working in OMM Studio

The editor provides visual scene configuration with buttons to add cubes or sprites to your project.

**Texturing** is handled through the "📷 Texture" button—select an image file and the editor automatically inserts the Base64-encoded `texture(...)` command into your code. When you're ready, use the **"Download .omm"** button to save in the correct binary format, preventing the browser from adding a `.txt` extension.

---

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

CORS restrictions may block `.omm` file loading when working locally (`file://`), so use a local server instead. Base64 encoding increases file size but enables models to function independently without external image dependencies.# OMM (Open Match Model)

**OMM** is an ultra-lightweight 3D model format and autonomous engine in pure JavaScript. Created for quick integration of 3D graphics into web projects without using heavy libraries (Zero Dependencies).

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

## 📝 Syntax and Features of .omm

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
* **Textures**: The `texture(...)` command replaces color with an image.
    * **External link**: `texture(https://site.com/img.png)`
    * **Local (Base64)**: In Studio editor, when loading an image, it is automatically encoded:
        `texture(data:image/png;base64,iVBOR...)`
    * *Note:* Texture is applied to all cube faces automatically.

---

## 🛠 Working in OMM Studio

The editor allows you to visually configure the scene:
1. **Adding**: Buttons "+ Cube" or "+ Sprite" insert basic code.
2. **Texturing**: Press "📷 Texture", select a file, and the editor will automatically insert `texture(base64...)` into the code.
3. **Saving**: The **"Download .omm"** button saves the file in the correct binary format, so the browser won't add a `.txt` extension.

---

## 💡 Advanced Usage (API)

You can manage the model directly from HTML using attributes of the `<omm-model>` tag:

| Attribute | Description |
| :--- | :--- |
| `src` | Path to the `.omm` file. |
| `autorate` | If present, the model will rotate infinitely. |
| `textContent` | You can write model code directly inside the tag. |

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
* **CORS**: When working with local files (`file://`), the browser may block `.omm` loading. It is recommended to use a local server (Live Server VS Code, Node.js, Python).
* **Base64**: Using Base64 inside `.omm` makes the file larger, but allows the model to work autonomously without external images.