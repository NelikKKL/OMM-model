//! Произвольная (не процедурная) геометрия для фигуры `mesh3`.
//!
//! Хранится либо как разобранный руками текст (`verts()/tris()/uvs()` в
//! `.omm`), либо как компактный бинарный блок, который кодируют конвертеры
//! `obj_to_omm` / `glb_to_omm` в base64 (`data(...)`). Все грани — треугольники
//! (n-угольники триангулируются конвертерами на входе).

use crate::types::Vec3;

pub type Tri = [u32; 3];

#[derive(Clone, Debug, Default)]
pub struct MeshData {
    pub v:    Vec<Vec3>,
    pub uv:   Option<Vec<(f32, f32)>>, // параллельно v, нормализовано 0..1
    pub tris: Vec<Tri>,
}

impl MeshData {
    /// Бинарный формат (little-endian), который несёт `data(base64...)`:
    ///   u32 vertex_count
    ///   u32 tri_count
    ///   u8  has_uv (0/1)
    ///   [vertex_count * 3] f32  — позиции (x,y,z)
    ///   если has_uv: [vertex_count * 2] f32 — uv (u,v)
    ///   [tri_count * 3] u32 — индексы треугольников
    pub fn pack(&self) -> Vec<u8> {
        let has_uv = self.uv.is_some();
        let mut out = Vec::with_capacity(
            9 + self.v.len() * 12
              + if has_uv { self.v.len() * 8 } else { 0 }
              + self.tris.len() * 12,
        );
        out.extend_from_slice(&(self.v.len() as u32).to_le_bytes());
        out.extend_from_slice(&(self.tris.len() as u32).to_le_bytes());
        out.push(has_uv as u8);

        for p in &self.v {
            out.extend_from_slice(&(p.x as f32).to_le_bytes());
            out.extend_from_slice(&(p.y as f32).to_le_bytes());
            out.extend_from_slice(&(p.z as f32).to_le_bytes());
        }
        if let Some(uvs) = &self.uv {
            for (u, v) in uvs {
                out.extend_from_slice(&u.to_le_bytes());
                out.extend_from_slice(&v.to_le_bytes());
            }
        }
        for t in &self.tris {
            out.extend_from_slice(&t[0].to_le_bytes());
            out.extend_from_slice(&t[1].to_le_bytes());
            out.extend_from_slice(&t[2].to_le_bytes());
        }
        out
    }

    pub fn unpack(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < 9 { return None; }
        let vc = u32::from_le_bytes(bytes[0..4].try_into().ok()?) as usize;
        let tc = u32::from_le_bytes(bytes[4..8].try_into().ok()?) as usize;
        let has_uv = bytes[8] != 0;
        let mut pos = 9usize;

        let need_v = vc.checked_mul(12)?;
        if bytes.len() < pos + need_v { return None; }
        let mut v = Vec::with_capacity(vc);
        for i in 0..vc {
            let o = pos + i * 12;
            let x = f32::from_le_bytes(bytes[o..o + 4].try_into().ok()?) as f64;
            let y = f32::from_le_bytes(bytes[o + 4..o + 8].try_into().ok()?) as f64;
            let z = f32::from_le_bytes(bytes[o + 8..o + 12].try_into().ok()?) as f64;
            v.push(Vec3 { x, y, z });
        }
        pos += need_v;

        let uv = if has_uv {
            let need_uv = vc.checked_mul(8)?;
            if bytes.len() < pos + need_uv { return None; }
            let mut uvs = Vec::with_capacity(vc);
            for i in 0..vc {
                let o = pos + i * 8;
                let u  = f32::from_le_bytes(bytes[o..o + 4].try_into().ok()?);
                let vv = f32::from_le_bytes(bytes[o + 4..o + 8].try_into().ok()?);
                uvs.push((u, vv));
            }
            pos += need_uv;
            Some(uvs)
        } else {
            None
        };

        let need_f = tc.checked_mul(12)?;
        if bytes.len() < pos + need_f { return None; }
        let mut tris = Vec::with_capacity(tc);
        for i in 0..tc {
            let o = pos + i * 12;
            let a = u32::from_le_bytes(bytes[o..o + 4].try_into().ok()?);
            let bx = u32::from_le_bytes(bytes[o + 4..o + 8].try_into().ok()?);
            let c = u32::from_le_bytes(bytes[o + 8..o + 12].try_into().ok()?);
            tris.push([a, bx, c]);
        }

        Some(MeshData { v, uv, tris })
    }
}
