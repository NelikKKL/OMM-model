/**
 * OMM Web Component — JavaScript wrapper for the Rust/WASM core.
 *
 * Usage (ESM, CDN):
 *   <script type="module">
 *     import 'https://cdn.jsdelivr.net/gh/NelikKKL/OMM-model@v3.0.0/pkg/omm-component.js';
 *   </script>
 *   <omm-model src="model.omm" autorate freer></omm-model>
 */

// ── Load WASM core ────────────────────────────────────────────────────────────

// Works both from CDN (relative to this file) and from a local pkg/ directory.
const WASM_URL = new URL('./omm_core.js', import.meta.url);

let wasmReady = null;
let OmmEngine = null;

async function initWasm() {
  if (wasmReady) return wasmReady;
  wasmReady = (async () => {
    const mod = await import(WASM_URL.href);
    await mod.default(); // call wasm-pack's `init()` to load the .wasm binary
    OmmEngine = mod.OmmEngine;
  })();
  return wasmReady;
}

// ── <omm-model> custom element ────────────────────────────────────────────────

class OmmModel extends HTMLElement {
  #engine    = null;
  #canvas    = null;
  #animating = false;
  #rafId     = null;
  #resizeObs = null;

  // Drag state
  #drag      = { active: false, mode: 0, lastX: 0, lastY: 0 };
  // Pinch state
  #pinch     = { active: false, initDist: 0, initZ: 0 };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#canvas = document.createElement('canvas');
    this.#canvas.style.cssText = 'width:100%;height:100%;display:block;';
    this.shadowRoot.appendChild(this.#canvas);
  }

  async connectedCallback() {
    await initWasm();

    this.#engine = new OmmEngine();
    this.#engine.setup(this.#canvas);

    // Resize observer keeps canvas pixels in sync with CSS size
    this.#resizeObs = new ResizeObserver(() => this.#resize());
    this.#resizeObs.observe(this);
    this.#resize();

    if (this.hasAttribute('freer')) this.#attachControls();

    // Small delay so the element has its final layout size
    setTimeout(() => this.#loadContent(), 50);
  }

  disconnectedCallback() {
    this.#resizeObs?.disconnect();
    if (this.#rafId) cancelAnimationFrame(this.#rafId);
    this.#engine?.free();
    this.#engine = null;
  }

  // ── Content loading ───────────────────────────────────────────────────────

  async #loadContent() {
    const src = this.getAttribute('src');
    let text = '';

    if (src?.endsWith('.omm')) {
      try {
        const res = await fetch(src);
        if (res.ok) text = await res.text();
        else        console.error(`OMM: failed to load "${src}" (${res.status})`);
      } catch (e) {
        console.error('OMM fetch error:', e);
      }
    } else {
      text = this.textContent?.trim() ?? '';
    }

    this.#engine.parse(text);
    await this.#loadTextures();

    if (this.hasAttribute('autorate') || this.#engine.has_animation()) {
      this.#startLoop();
    } else {
      this.#engine.render();
    }
  }

  async #loadTextures() {
    const pending = Array.from(this.#engine.pending_textures());
    if (!pending.length) return;

    await Promise.allSettled(pending.map(src => new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => { this.#engine.set_texture(src, img); resolve(); };
      img.onerror = () => resolve(); // skip broken textures
      img.src = src;
    })));

    this.#engine.render();
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  #startLoop() {
    if (this.#animating) return;
    this.#animating = true;
    const tick = () => {
      if (!this.#animating || !this.#engine) return;
      if (this.hasAttribute('autorate')) this.#engine.auto_rotate();
      this.#engine.step();
      this.#engine.render();
      this.#rafId = requestAnimationFrame(tick);
    };
    this.#rafId = requestAnimationFrame(tick);
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  #resize() {
    const w = this.offsetWidth  || 300;
    const h = this.offsetHeight || 300;
    this.#engine?.resize(w, h);
    if (!this.#animating) this.#engine?.render();
  }

  // ── Controls (freer mode) ─────────────────────────────────────────────────

  #attachControls() {
    const el = this.#canvas;
    el.style.cursor = 'grab';

    // ── Mouse ───────────────────────────────────────────────────────────────
    el.addEventListener('mousedown', e => {
      this.#drag = {
        active: true,
        mode:   (e.button === 1 || e.button === 2) ? 1 : 0,
        lastX:  e.clientX,
        lastY:  e.clientY,
      };
      el.style.cursor = this.#drag.mode === 0 ? 'grabbing' : 'move';
    });

    const onMouseMove = e => {
      if (!this.#drag.active) return;
      const dx = e.clientX - this.#drag.lastX;
      const dy = e.clientY - this.#drag.lastY;
      this.#drag.lastX = e.clientX;
      this.#drag.lastY = e.clientY;
      this.#engine.drag(dx, dy, this.#drag.mode);
      if (!this.#animating) this.#engine.render();
    };

    const onMouseUp = () => {
      this.#drag.active = false;
      el.style.cursor = 'grab';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    el.addEventListener('contextmenu', e => e.preventDefault());

    el.addEventListener('wheel', e => {
      e.preventDefault();
      this.#engine.zoom(e.deltaY);
      if (!this.#animating) this.#engine.render();
    }, { passive: false });

    // ── Touch ───────────────────────────────────────────────────────────────
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length === 1) {
        this.#drag = {
          active: true, mode: 0,
          lastX: e.touches[0].clientX,
          lastY: e.touches[0].clientY,
        };
        this.#pinch.active = false;
      } else if (e.touches.length === 2) {
        this.#drag.active = false;
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        this.#pinch = { active: true, initDist: dist, initZ: this.#engine.camera_z() };
      }
    }, { passive: false });

    el.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && this.#drag.active) {
        const dx = e.touches[0].clientX - this.#drag.lastX;
        const dy = e.touches[0].clientY - this.#drag.lastY;
        this.#drag.lastX = e.touches[0].clientX;
        this.#drag.lastY = e.touches[0].clientY;
        this.#engine.drag(dx, dy, 0);
        if (!this.#animating) this.#engine.render();
      } else if (e.touches.length === 2 && this.#pinch.active) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        this.#engine.pinch_zoom(this.#pinch.initZ, this.#pinch.initDist, dist);
        if (!this.#animating) this.#engine.render();
      }
    }, { passive: false });

    el.addEventListener('touchend', () => {
      this.#drag.active  = false;
      this.#pinch.active = false;
    });
  }
}

customElements.define('omm-model', OmmModel);
