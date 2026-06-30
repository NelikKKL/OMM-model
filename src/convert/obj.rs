//! Минимальный парсер Wavefront OBJ (`.obj`).
//!
//! Поддерживает: `v` (вершины), `vt` (UV), `f` (грани — треугольники и
//! n-угольники, триангулируются веером). Нормали (`vn`) игнорируются — OMM
//! сам считает плоское освещение по грани для `mesh3`. Материалы (`.mtl`)
//! не парсятся: результат получает нейтральный серый цвет, цвет/текстуру
//! можно дописать вручную в получившийся `.omm`-текст (`color(...)`,
//! `texture(...)`).

use std::collections::HashMap;

use crate::convert::Primitive;
use crate::mesh::MeshData;
use crate::types::Vec3;

pub fn obj_to_mesh(text: &str) -> Result<MeshData, String> {
    let mut positions: Vec<Vec3> = Vec::new();
    let mut texcoords: Vec<(f32, f32)> = Vec::new();

    // Дедупликация по паре (индекс позиции, индекс uv) — OBJ хранит их
    // раздельно, а нам нужен один индекс на (позиция+uv) для треугольников.
    let mut vert_map: HashMap<(usize, i64), u32> = HashMap::new();
    let mut out_v: Vec<Vec3> = Vec::new();
    let mut out_uv: Vec<(f32, f32)> = Vec::new();
    let mut any_uv = false;
    let mut tris: Vec<[u32; 3]> = Vec::new();

    for line in text.lines() {
        let l = line.trim();
        if l.is_empty() || l.starts_with('#') { continue; }
        let mut it = l.split_whitespace();
        let Some(tag) = it.next() else { continue };

        match tag {
            "v" => {
                let nums: Vec<f64> = it.filter_map(|s| s.parse().ok()).collect();
                if nums.len() >= 3 {
                    // glTF/OBJ обычно правосторонние с Y вверх, OMM использует
                    // Y как «вниз» (как координаты экрана) — инвертируем.
                    positions.push(Vec3 { x: nums[0], y: -nums[1], z: nums[2] });
                }
            }
            "vt" => {
                let nums: Vec<f32> = it.filter_map(|s| s.parse().ok()).collect();
                match nums.len() {
                    0 => {}
                    1 => texcoords.push((nums[0], 0.0)),
                    _ => texcoords.push((nums[0], nums[1])),
                }
            }
            "f" => {
                let tokens: Vec<&str> = it.collect();
                if tokens.len() < 3 { continue; }
                let mut idxs: Vec<u32> = Vec::with_capacity(tokens.len());

                for tok in &tokens {
                    let mut parts = tok.split('/');
                    let Some(Some(vi)) = parts.next().map(|s| s.parse::<i64>().ok()) else { continue };
                    let vti = parts.next()
                        .filter(|s| !s.is_empty())
                        .and_then(|s| s.parse::<i64>().ok());

                    let pos_index = resolve_index(vi, positions.len());
                    if pos_index >= positions.len() { continue; }

                    let uv_index: i64 = match vti {
                        Some(t) => resolve_index(t, texcoords.len()) as i64,
                        None => -1,
                    };

                    let key = (pos_index, uv_index);
                    let merged = *vert_map.entry(key).or_insert_with(|| {
                        let id = out_v.len() as u32;
                        out_v.push(positions[pos_index].clone());
                        if uv_index >= 0 && (uv_index as usize) < texcoords.len() {
                            out_uv.push(texcoords[uv_index as usize]);
                            any_uv = true;
                        } else {
                            out_uv.push((0.0, 0.0));
                        }
                        id
                    });
                    idxs.push(merged);
                }

                if idxs.len() < 3 { continue; }
                // Веерная триангуляция n-угольника; порядок вершин развёрнут,
                // чтобы компенсировать инверсию оси Y выше (иначе грани
                // окажутся "вывернуты" для расчёта нормали/освещения).
                for k in 1..idxs.len() - 1 {
                    tris.push([idxs[0], idxs[k + 1], idxs[k]]);
                }
            }
            _ => {}
        }
    }

    if out_v.is_empty() || tris.is_empty() {
        return Err("в OBJ-файле не найдено геометрии (нужны строки 'v' и 'f')".into());
    }

    let uv = if any_uv { Some(out_uv) } else { None };
    Ok(MeshData { v: out_v, uv, tris })
}

fn resolve_index(raw: i64, len: usize) -> usize {
    if raw > 0 { (raw - 1) as usize } else { (len as i64 + raw).max(0) as usize }
}

/// Конвертирует текст `.obj` целиком в готовый `.omm`-текст (один блок `mesh3`).
pub fn obj_to_omm(text: &str) -> Result<String, String> {
    let mesh = obj_to_mesh(text)?;
    let prims = vec![Primitive { mesh, color: [200, 200, 200], texture: None }];
    Ok(crate::convert::primitives_to_omm(&prims))
}
