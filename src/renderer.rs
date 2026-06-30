use std::collections::HashMap;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, HtmlImageElement};

use crate::types::{Camera, CameraTrig, OmmObject, ShapeType, Vec3, Face};
use crate::geometry::*;

// ── Internal draw primitives ──────────────────────────────────────────────────

#[derive(Clone)]
struct Pt {
    x: f64,
    y: f64,
    z: f64,
}


enum DrawCmd {
    /// Solid filled polygon (3 or 4 vertices)
    Solid {
        pts:   [Pt; 4],
        n:     usize,
        rgb:   [u8; 3],
        shade: f64,
    },
    /// Textured triangle with per-vertex UV
    TexTri {
        pts: [Pt; 3],
        tex: HtmlImageElement,
        u:   [f64; 3],
        v:   [f64; 3],
    },
}

struct DrawableFace {
    z:   f64,
    cmd: DrawCmd,
}

// ── Renderer ──────────────────────────────────────────────────────────────────

pub struct Renderer {
    canvas: HtmlCanvasElement,
    ctx:    CanvasRenderingContext2d,
    pub focal: f64,
}

impl Renderer {
    pub fn new(canvas: HtmlCanvasElement, ctx: CanvasRenderingContext2d) -> Self {
        Self { canvas, ctx, focal: 600.0 }
    }

    pub fn canvas(&self) -> &HtmlCanvasElement { &self.canvas }

    // ── Main render ───────────────────────────────────────────────────────────

    pub fn render(
        &self,
        objects:  &[OmmObject],
        camera:   &Camera,
        textures: &HashMap<String, HtmlImageElement>,
    ) {
        let w = self.canvas.width()  as f64;
        let h = self.canvas.height() as f64;
        self.ctx.clear_rect(0.0, 0.0, w, h);

        let cam_trig = CameraTrig {
            srx: camera.rx.sin(), crx: camera.rx.cos(),
            sry: camera.ry.sin(), cry: camera.ry.cos(),
        };

        // Collect all faces
        let mut all_faces: Vec<DrawableFace> = Vec::new();
        for obj in objects {
            let tex = obj.tex_src.as_deref().and_then(|s| textures.get(s));
            let faces = self.collect_faces(obj, camera, &cam_trig, w, h, tex);
            all_faces.extend(faces);
        }

        // Depth sort: back-to-front (painter's algorithm)
        all_faces.sort_by(|a, b| b.z.partial_cmp(&a.z).unwrap_or(std::cmp::Ordering::Equal));

        for face in &all_faces {
            self.draw_face(face);
        }
    }

    // ── Projection ────────────────────────────────────────────────────────────

    fn project(
        &self,
        px: f64, py: f64, pz: f64,
        cos_rx: f64, sin_rx: f64,
        cos_ry: f64, sin_ry: f64,
        ox: f64, oy: f64, oz: f64,
        camera: &Camera,
        ct: &CameraTrig,
        w: f64, h: f64,
    ) -> Pt {
        // Object rotation (Rx then Ry)
        let a_ty = py * cos_rx - pz * sin_rx;
        let a_tz = py * sin_rx + pz * cos_rx;
        let a_tx = px * cos_ry + a_tz * sin_ry;
        let a_tz = -px * sin_ry + a_tz * cos_ry; // shadowing is intentional

        // World position
        let wx = a_tx + ox;
        let wy = a_ty + oy;
        let wz = a_tz + oz;

        // Camera rotation (pre-cached trig)
        let cy = wy * ct.crx - wz * ct.srx;
        let cz = wy * ct.srx + wz * ct.crx;
        let cx = wx * ct.cry + cz * ct.sry;
        let cz = -wx * ct.sry + cz * ct.cry; // shadow

        let sc = self.focal / (self.focal + cz + camera.z);
        Pt {
            x: cx * sc + w * 0.5 + camera.cx,
            y: cy * sc + h * 0.5 + camera.cy,
            z: cz,
        }
    }

    // ── Face collection ───────────────────────────────────────────────────────

    fn collect_faces(
        &self,
        obj:     &OmmObject,
        camera:  &Camera,
        ct:      &CameraTrig,
        w:       f64,
        h:       f64,
        tex_opt: Option<&HtmlImageElement>,
    ) -> Vec<DrawableFace> {
        if obj.shape == ShapeType::Mesh {
            return self.collect_mesh_faces(obj, camera, ct, w, h, tex_opt);
        }

        let (raw_v, raw_f): (Vec<Vec3>, Option<Vec<Face>>) =
            match obj.shape {
                ShapeType::Cube     => (cube_v(),     Some(cube_f())),
                ShapeType::Pyramid  => (pyramid_v(),  Some(pyramid_f())),
                ShapeType::Triangle => (triangle_v(), Some(triangle_f())),
                ShapeType::Sphere   => { let g = build_sphere_geo();   (g.v, Some(g.faces)) }
                ShapeType::Cylinder => { let g = build_cylinder_geo(); (g.v, Some(g.faces)) }
                ShapeType::Image    => (image_v(),    None),
                ShapeType::Mesh     => unreachable!(),
            };

        let s  = obj.s;
        let sy = s * obj.sy;
        let cos_rx = obj.rx.cos(); let sin_rx = obj.rx.sin();
        let cos_ry = obj.ry.cos(); let sin_ry = obj.ry.sin();
        let has_deform = obj.ur != 0.0 || obj.ul != 0.0
            || obj.ug != 0.0 || obj.um != 0.0
            || obj.ud != 0.0 || obj.uu != 0.0;

        // Project all vertices
        let pts: Vec<Pt> = raw_v.iter().map(|rv| {
            let mut vx = rv.x * s;
            let mut vy = rv.y * sy;
            let mut vz = rv.z * s;

            if has_deform {
                if      vx > 0.0 { vx = (vx / s)  * (s  + obj.ur); }
                else if vx < 0.0 { vx = (vx / s)  * (s  + obj.ul); }
                if sy != 0.0 {
                    if      vy > 0.0 { vy = (vy / sy) * (sy + obj.ud); }
                    else if vy < 0.0 { vy = (vy / sy) * (sy + obj.uu); }
                }
                if      vz > 0.0 { vz = (vz / s)  * (s  + obj.ug); }
                else if vz < 0.0 { vz = (vz / s)  * (s  + obj.um); }
            }

            self.project(vx, vy, vz, cos_rx, sin_rx, cos_ry, sin_ry,
                         obj.x, obj.y, obj.z, camera, ct, w, h)
        }).collect();

        // ── image3: two textured triangles ────────────────────────────────────
        if obj.shape == ShapeType::Image {
            let Some(tex) = tex_opt else { return vec![] };
            if !tex.complete() || tex.natural_width() == 0 { return vec![]; }
            let tw = tex.natural_width()  as f64;
            let th = tex.natural_height() as f64;

            let z1 = (pts[0].z + pts[1].z + pts[2].z) / 3.0;
            let z2 = (pts[0].z + pts[2].z + pts[3].z) / 3.0;

            return vec![
                DrawableFace {
                    z: z1,
                    cmd: DrawCmd::TexTri {
                        pts: [pts[0].clone(), pts[1].clone(), pts[2].clone()],
                        tex: tex.clone(),
                        u:   [0.0, tw, tw],
                        v:   [0.0, 0.0, th],
                    },
                },
                DrawableFace {
                    z: z2,
                    cmd: DrawCmd::TexTri {
                        pts: [pts[0].clone(), pts[2].clone(), pts[3].clone()],
                        tex: tex.clone(),
                        u:   [0.0, tw, 0.0],
                        v:   [0.0, th, th],
                    },
                },
            ];
        }

        // ── Regular shapes ────────────────────────────────────────────────────
        let faces = raw_f.unwrap();
        let nf = faces.len();
        let mut result: Vec<DrawableFace> = Vec::with_capacity(nf * 2);

        for (fi, face) in faces.iter().enumerate() {
            let n = face.len(); // 3 or 4
            let z_sum: f64 = face.iter().map(|&k| pts[k].z).sum();
            let z = z_sum / n as f64;

            if let Some(tex) = tex_opt {
                if tex.complete() && tex.natural_width() > 0 {
                    let tw = tex.natural_width()  as f64;
                    let th = tex.natural_height() as f64;

                    if n == 4 {
                        // Quad → two textured triangles
                        let z_a = (pts[face[0]].z + pts[face[1]].z + pts[face[2]].z) / 3.0;
                        let z_b = (pts[face[0]].z + pts[face[2]].z + pts[face[3]].z) / 3.0;
                        result.push(DrawableFace {
                            z: z_a,
                            cmd: DrawCmd::TexTri {
                                pts: [pts[face[0]].clone(), pts[face[1]].clone(), pts[face[2]].clone()],
                                tex: tex.clone(),
                                u: [0.0,  tw, tw],
                                v: [0.0, 0.0, th],
                            },
                        });
                        result.push(DrawableFace {
                            z: z_b,
                            cmd: DrawCmd::TexTri {
                                pts: [pts[face[0]].clone(), pts[face[2]].clone(), pts[face[3]].clone()],
                                tex: tex.clone(),
                                u: [0.0,  tw, 0.0],
                                v: [0.0,  th,  th],
                            },
                        });
                    } else {
                        // Triangle
                        result.push(DrawableFace {
                            z,
                            cmd: DrawCmd::TexTri {
                                pts: [pts[face[0]].clone(), pts[face[1]].clone(), pts[face[2]].clone()],
                                tex: tex.clone(),
                                u: [tw * 0.5, tw, 0.0],
                                v: [0.0,       th,  th],
                            },
                        });
                    }
                    continue;
                }
            }

            // Solid shading: index-based approximation
            let shade = match obj.shape {
                ShapeType::Sphere   => (0.8  + (fi % 8)  as f64 * 0.05_f64).min(1.0),
                ShapeType::Cylinder => (0.85 + (fi % 10) as f64 * 0.04_f64).min(1.0),
                _                   => (0.85 + (fi % nf) as f64 * 0.05_f64).min(1.0),
            };

            let blank_pt = Pt { x: 0.0, y: 0.0, z: 0.0 };
            let p0 = pts[face[0]].clone();
            let p1 = pts[face[1]].clone();
            let p2 = pts[face[2]].clone();
            let p3 = if n == 4 { pts[face[3]].clone() } else { blank_pt };

            result.push(DrawableFace {
                z,
                cmd: DrawCmd::Solid {
                    pts: [p0, p1, p2, p3],
                    n,
                    rgb:   obj.rgb,
                    shade,
                },
            });
        }

        result
    }

    // ── Произвольная геометрия (`mesh3`) ──────────────────────────────────────

    fn collect_mesh_faces(
        &self,
        obj:     &OmmObject,
        camera:  &Camera,
        ct:      &CameraTrig,
        w:       f64,
        h:       f64,
        tex_opt: Option<&HtmlImageElement>,
    ) -> Vec<DrawableFace> {
        let Some(geo) = obj.mesh.as_ref() else { return vec![] };

        let s  = obj.s;
        let sy = s * obj.sy;
        let cos_rx = obj.rx.cos(); let sin_rx = obj.rx.sin();
        let cos_ry = obj.ry.cos(); let sin_ry = obj.ry.sin();

        let pts: Vec<Pt> = geo.v.iter().map(|rv| {
            self.project(rv.x * s, rv.y * sy, rv.z * s, cos_rx, sin_rx, cos_ry, sin_ry,
                         obj.x, obj.y, obj.z, camera, ct, w, h)
        }).collect();

        let has_tex = tex_opt.is_some_and(|t| t.complete() && t.natural_width() > 0);
        let tw = tex_opt.map_or(0.0, |t| t.natural_width()  as f64);
        let th = tex_opt.map_or(0.0, |t| t.natural_height() as f64);

        let mut result: Vec<DrawableFace> = Vec::with_capacity(geo.tris.len());

        for tri in &geo.tris {
            let (a, b, c) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
            if a >= pts.len() || b >= pts.len() || c >= pts.len() { continue; }
            let z = (pts[a].z + pts[b].z + pts[c].z) / 3.0;

            if has_tex {
                if let Some(uv) = &geo.uv {
                    let tex = tex_opt.unwrap();
                    result.push(DrawableFace {
                        z,
                        cmd: DrawCmd::TexTri {
                            pts: [pts[a].clone(), pts[b].clone(), pts[c].clone()],
                            tex: tex.clone(),
                            u: [uv[a].0 as f64 * tw, uv[b].0 as f64 * tw, uv[c].0 as f64 * tw],
                            v: [uv[a].1 as f64 * th, uv[b].1 as f64 * th, uv[c].1 as f64 * th],
                        },
                    });
                    continue;
                }
            }

            // Плоское освещение по нормали грани (в локальном пространстве
            // объекта — направленный свет сверху-спереди + базовая ambient).
            let e1 = (geo.v[b].x - geo.v[a].x, geo.v[b].y - geo.v[a].y, geo.v[b].z - geo.v[a].z);
            let e2 = (geo.v[c].x - geo.v[a].x, geo.v[c].y - geo.v[a].y, geo.v[c].z - geo.v[a].z);
            let nx = e1.1 * e2.2 - e1.2 * e2.1;
            let ny = e1.2 * e2.0 - e1.0 * e2.2;
            let nz = e1.0 * e2.1 - e1.1 * e2.0;
            let len = (nx * nx + ny * ny + nz * nz).sqrt().max(1e-9);
            const LIGHT: (f64, f64, f64) = (0.4, -0.7, -0.6);
            let dot = (nx * LIGHT.0 + ny * LIGHT.1 + nz * LIGHT.2) / len;
            let shade = (0.55 + dot.max(0.0) * 0.45).min(1.0);

            let blank_pt = Pt { x: 0.0, y: 0.0, z: 0.0 };
            result.push(DrawableFace {
                z,
                cmd: DrawCmd::Solid {
                    pts: [pts[a].clone(), pts[b].clone(), pts[c].clone(), blank_pt],
                    n: 3,
                    rgb: obj.rgb,
                    shade,
                },
            });
        }

        result
    }

    // ── Draw a single face ────────────────────────────────────────────────────

    fn draw_face(&self, fd: &DrawableFace) {
        match &fd.cmd {
            DrawCmd::Solid { pts, n, rgb, shade } => {
                let ctx = &self.ctx;
                ctx.begin_path();
                ctx.move_to(pts[0].x, pts[0].y);
                ctx.line_to(pts[1].x, pts[1].y);
                ctx.line_to(pts[2].x, pts[2].y);
                if *n == 4 { ctx.line_to(pts[3].x, pts[3].y); }
                ctx.close_path();

                let sh = shade;
                let r = (rgb[0] as f64 * sh) as u8;
                let g = (rgb[1] as f64 * sh) as u8;
                let b = (rgb[2] as f64 * sh) as u8;
                ctx.set_fill_style_str(&format!("rgb({r},{g},{b})"));
                ctx.fill();
                ctx.set_stroke_style_str("rgba(0,0,0,0.15)");
                ctx.stroke();
            }

            DrawCmd::TexTri { pts, tex, u, v } => {
                self.draw_textured_triangle(
                    &pts[0], &pts[1], &pts[2],
                    u[0], v[0], u[1], v[1], u[2], v[2],
                    tex,
                );
            }
        }
    }

    // ── Textured triangle via affine UV transform ─────────────────────────────

    fn draw_textured_triangle(
        &self,
        p1: &Pt, p2: &Pt, p3: &Pt,
        u1: f64, v1: f64,
        u2: f64, v2: f64,
        u3: f64, v3: f64,
        img: &HtmlImageElement,
    ) {
        let ctx = &self.ctx;
        ctx.save();
        ctx.begin_path();
        ctx.move_to(p1.x, p1.y);
        ctx.line_to(p2.x, p2.y);
        ctx.line_to(p3.x, p3.y);
        ctx.close_path();
        ctx.clip();

        // Compute affine transform that maps UV → screen
        let det  = (u2 - u1) * (v3 - v1) - (u3 - u1) * (v2 - v1);
        if det.abs() < 1e-10 { ctx.restore(); return; }
        let idet = 1.0 / det;
        let m11 = ((p2.x - p1.x) * (v3 - v1) - (p3.x - p1.x) * (v2 - v1)) * idet;
        let m12 = ((p2.y - p1.y) * (v3 - v1) - (p3.y - p1.y) * (v2 - v1)) * idet;
        let m21 = ((p3.x - p1.x) * (u2 - u1) - (p2.x - p1.x) * (u3 - u1)) * idet;
        let m22 = ((p3.y - p1.y) * (u2 - u1) - (p2.y - p1.y) * (u3 - u1)) * idet;
        let dx  = p1.x - m11 * u1 - m21 * v1;
        let dy  = p1.y - m12 * u1 - m22 * v1;

        let _ = ctx.set_transform(m11, m12, m21, m22, dx, dy);
        let _ = ctx.draw_image_with_html_image_element(img, 0.0, 0.0);
        ctx.restore();
    }
}
