mod types;
mod geometry;
mod parser;
mod animation;
mod renderer;

use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, HtmlImageElement};

use types::{Camera, OmmObject, MonoGroup};
use parser::parse_omm;
use renderer::Renderer;
use animation::step_animation;

// ── Engine ────────────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub struct OmmEngine {
    objects:      Vec<OmmObject>,
    mono_groups:  HashMap<u32, MonoGroup>,
    textures:     HashMap<String, HtmlImageElement>,
    camera:       Camera,
    has_animation: bool,
    renderer:     Option<Renderer>,
}

#[wasm_bindgen]
impl OmmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            objects:      Vec::new(),
            mono_groups:  HashMap::new(),
            textures:     HashMap::new(),
            camera:       Camera::default(),
            has_animation: false,
            renderer:     None,
        }
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    /// Bind the engine to a canvas element. Must be called before render().
    pub fn setup(&mut self, canvas: HtmlCanvasElement) {
        let ctx = canvas
            .get_context("2d")
            .unwrap()
            .unwrap()
            .dyn_into::<CanvasRenderingContext2d>()
            .unwrap();
        self.renderer = Some(Renderer::new(canvas, ctx));
    }

    /// Resize the internal canvas to new pixel dimensions.
    pub fn resize(&self, width: u32, height: u32) {
        if let Some(r) = &self.renderer {
            r.canvas().set_width(width);
            r.canvas().set_height(height);
        }
    }

    // ── Parse ─────────────────────────────────────────────────────────────────

    /// Parse OMM scene text and replace current scene.
    pub fn parse(&mut self, txt: &str) {
        let result = parse_omm(txt);
        self.objects      = result.objects;
        self.mono_groups  = result.mono_groups;
        self.has_animation = result.has_animation;
    }

    // ── Textures ──────────────────────────────────────────────────────────────

    /// Returns an Array of texture URL strings that have not been loaded yet.
    /// Call this after parse(), load each URL as an Image in JS, then
    /// call set_texture() when each image fires its onload event.
    pub fn pending_textures(&self) -> js_sys::Array {
        let arr = js_sys::Array::new();
        for obj in &self.objects {
            if let Some(ref src) = obj.tex_src {
                if !self.textures.contains_key(src) {
                    arr.push(&JsValue::from_str(src));
                }
            }
        }
        arr
    }

    /// Register a loaded HTMLImageElement for a given texture URL.
    pub fn set_texture(&mut self, src: &str, img: HtmlImageElement) {
        self.textures.insert(src.to_string(), img);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    /// Render the current frame to the bound canvas.
    pub fn render(&self) {
        if let Some(ref r) = self.renderer {
            r.render(&self.objects, &self.camera, &self.textures);
        }
    }

    // ── Animation ─────────────────────────────────────────────────────────────

    /// Advance all object animations by one tick.
    pub fn step(&mut self) {
        step_animation(&mut self.objects);
    }

    /// Rotate the camera around the Y-axis (for `autorate` mode).
    pub fn auto_rotate(&mut self) {
        self.camera.ry += 0.01;
    }

    // ── Camera controls ───────────────────────────────────────────────────────

    /// Apply a mouse/touch drag delta (dx = horizontal pixels, dy = vertical).
    /// mode 0 = rotate, mode 1 = pan.
    pub fn drag(&mut self, dx: f64, dy: f64, mode: u8) {
        if mode == 0 {
            self.camera.ry -= dx * 0.01;
            self.camera.rx += dy * 0.01;
        } else {
            self.camera.cx += dx;
            self.camera.cy += dy;
        }
    }

    /// Zoom by a wheel delta value (positive = zoom out).
    pub fn zoom(&mut self, delta: f64) {
        self.camera.z += delta * 0.5;
        let min = -self.focal() + 10.0;
        if self.camera.z < min { self.camera.z = min; }
    }

    /// Apply a pinch-zoom scale factor relative to an initial camera Z.
    pub fn pinch_zoom(&mut self, initial_z: f64, initial_dist: f64, current_dist: f64) {
        if current_dist > 0.0 {
            self.camera.z = initial_z * (initial_dist / current_dist);
            let min = -self.focal() + 10.0;
            if self.camera.z < min { self.camera.z = min; }
        }
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    pub fn has_animation(&self) -> bool { self.has_animation }

    pub fn focal(&self) -> f64 {
        self.renderer.as_ref().map_or(600.0, |r| r.focal)
    }

    /// Current camera Z (used by JS to save initial_z for pinch zoom).
    pub fn camera_z(&self) -> f64 { self.camera.z }
}
