# OMM (Open Match Model)

[READ in English](https://github.com/NelikKKL/OMM-model/blob/main/README.EN.md)

**OMM** — сверхлегкий формат 3D-моделей и автономный движок, написанный на **Rust** и скомпилированный в **WebAssembly**. Создан для быстрой интеграции 3D-графики в веб-проекты без сторонних зависимостей.

> **v3.0** — полная переработка на Rust/WASM. Ядро рендерера (~30 КБ `.wasm`) компилируется из безопасного Rust, тонкая JS-обёртка регистрирует Web Component.

## 📦 Подключение

### CDN — один тег (ESM)
```html
<script type="module"
  src="https://cdn.jsdelivr.net/gh/NelikKKL/OMM-model@v2.0.5/pkg/omm-component.js">
</script>
```

Файлы `omm_core.js` и `omm_core_bg.wasm` загружаются автоматически (они лежат рядом на CDN).

### Локально
Скачайте три файла из [Releases](https://github.com/NelikKKL/OMM-model/releases) в одну папку:
- `omm-component.js`
- `omm_core.js`
- `omm_core_bg.wasm`

```html
<script type="module" src="./omm-component.js"></script>
```

> ⚠️ Требуется локальный HTTP-сервер (Live Server, `python -m http.server` и т.д.) — браузеры блокируют WASM/модули с `file://`.

## 🚀 Быстрый старт

```html
<!-- Автовращение -->
<omm-model src="model.omm" autorate></omm-model>

<!-- Полный контроль (мышь + тач + зум) -->
<omm-model src="model.omm" freer></omm-model>

<!-- Модель прямо в теге -->
<omm-model autorate>
  cube3
  color(80, 140, 255)
  scale(2)
</omm-model>
```

### Атрибуты `<omm-model>`

| Атрибут | Описание |
| :--- | :--- |
| `src` | Путь к файлу `.omm`. |
| `autorate` | Бесконечное автовращение модели. |
| `freer` | Вращение мышью/тачем + пинч-зум + панорамирование (ПКМ / средняя кнопка). |

---

## 📝 Синтаксис `.omm`

Файл `.omm` — текстовый документ. Каждая фигура начинается с ключевого слова.

### 1. Геометрия

| Ключевое слово | Описание |
| :--- | :--- |
| `cube3` | Стандартный куб. |
| `cube3 : 4` | Плита (высота уменьшена в 4 раза). |
| `pyramid3` | Пирамида. |
| `sphere3` | Сфера. |
| `cylinder3` | Цилиндр. |
| `triangle3` | Плоский треугольник. |
| `image3` | Плоскость с текстурой (billboard). |

### 2. Трансформации

```
x(n)     y(n)     z(n)     — позиция (y идёт вверх, отрицательные значения поднимают)
scale(n)                    — масштаб (по умолчанию 50 пикселей на грань)
rr(deg)                     — поворот вправо (ось Y)
ru(deg)                     — поворот вверх  (ось X)
```

### 3. Анимация

```
animation(x0 y0 z0, x0 y200 z0)   — список ключевых точек через запятую
animation(y200, y0)                — можно указать только нужные оси
```

В ключевых точках поддерживаются `x`, `y`, `z`, `rr`, `ru`.

### 4. Асимметричная деформация

Растяжение сторон (работает для всех типов, кроме `cube3`):

```
ur(n)  ul(n)   — вправо / влево (ось X)
uu(n)  ud(n)   — вверх  / вниз  (ось Y)
ug(n)  um(n)   — вперёд / назад (ось Z)
```

### 5. Цвет и текстуры

```
color(R, G, B)                         — цвет заливки, 0–255
texture(https://site.com/img.png)      — внешняя ссылка
texture(data:image/png;base64,iVBOR…)  — встроенный Base64
```

Текстура накладывается на все грани фигуры автоматически.

### 6. Группировка `mono()`

Объединяет несколько фигур в одну, которая анимируется и трансформируется как единое целое:

```
mono(
  x(0) y(0) scale(1)   ← группа-трансформ (необязательно)

  cube3
  color(150, 150, 150)
  y(200)

  sphere3
  color(200, 100, 50)
)
```

---

## 💡 Полный пример

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module"
    src="https://cdn.jsdelivr.net/gh/NelikKKL/OMM-model@v2.0.5/pkg/omm-component.js">
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

## 🔧 Сборка из исходников

Требования: [Rust](https://rustup.rs/) + [wasm-pack](https://rustwasm.github.io/wasm-pack/).

```bash
wasm-pack build --release --target web --out-dir pkg
cp js/omm-component.js pkg/
```

Артефакты появятся в `pkg/`.

---

## ⚠️ Технические нюансы

- **CORS**: при загрузке `.omm`-файла браузер может заблокировать запрос с `file://`. Используйте локальный HTTP-сервер.
- **Base64**: текстуры в Base64 увеличивают размер `.omm`-файла, но делают модель полностью автономной.
- **ESM only**: v3.x использует ES-модули и `<script type="module">`. Старый подход `<script src="...">` не поддерживается.
