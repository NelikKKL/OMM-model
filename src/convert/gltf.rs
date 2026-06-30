//! Минимальный загрузчик бинарного glTF (`.glb`) → `mesh3`.
//!
//! Поддерживается самый частый случай экспорта (Blender и т.п.): один файл
//! `.glb` со встроенным бинарным чанком (буфер вершин/индексов) и, опционально,
//! встроенными PNG/JPEG-текстурами. Обходит полную иерархию узлов сцены и
//! "запекает" трансформации (translation/rotation/scale или matrix) прямо в
//! координаты вершин — поэтому результирующий `mesh3` не требует никаких
//! доп. трансформаций в OMM, кроме обычных `scale()`/`x()`/`y()`/`z()` по
//! желанию пользователя.
//!
//! Не поддерживается: отдельный `.gltf` + внешние `.bin`/`.jpg` (только
//! самодостаточный `.glb`), скелетная анимация, морф-таргеты, любые режимы
//! примитивов кроме TRIANGLES.

use crate::base64;
use crate::convert::Primitive;
use crate::json::Json;
use crate::mesh::MeshData;
use crate::types::Vec3;

const GLB_MAGIC: u32 = 0x4654_6C67; // "glTF" little-endian
const CHUNK_JSON: u32 = 0x4E4F_534A; // "JSON"
const CHUNK_BIN: u32 = 0x004E_4942; // "BIN\0"

type Mat4 = [f64; 16];

fn identity() -> Mat4 {
    let mut m = [0.0; 16];
    m[0] = 1.0; m[5] = 1.0; m[10] = 1.0; m[15] = 1.0;
    m
}

fn mat_mul(a: &Mat4, b: &Mat4) -> Mat4 {
    let mut r = [0.0; 16];
    for c in 0..4 {
        for row in 0..4 {
            let mut s = 0.0;
            for k in 0..4 { s += a[k * 4 + row] * b[c * 4 + k]; }
            r[c * 4 + row] = s;
        }
    }
    r
}

fn mat_from_trs(t: [f64; 3], q: [f64; 4], s: [f64; 3]) -> Mat4 {
    let (x, y, z, w) = (q[0], q[1], q[2], q[3]);
    let (x2, y2, z2) = (x + x, y + y, z + z);
    let (xx, xy, xz) = (x * x2, x * y2, x * z2);
    let (yy, yz, zz) = (y * y2, y * z2, z * z2);
    let (wx, wy, wz) = (w * x2, w * y2, w * z2);

    let mut m = identity();
    m[0] = (1.0 - (yy + zz)) * s[0]; m[1] = (xy + wz) * s[0];        m[2] = (xz - wy) * s[0];
    m[4] = (xy - wz) * s[1];         m[5] = (1.0 - (xx + zz)) * s[1]; m[6] = (yz + wx) * s[1];
    m[8] = (xz + wy) * s[2];         m[9] = (yz - wx) * s[2];        m[10] = (1.0 - (xx + yy)) * s[2];
    m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
    m
}

fn node_matrix(n: &Json) -> Mat4 {
    if let Some(arr) = n.get("matrix").and_then(Json::as_arr) {
        if arr.len() == 16 {
            let mut m = [0.0; 16];
            for (i, slot) in m.iter_mut().enumerate() {
                *slot = arr[i].as_f64().unwrap_or(0.0);
            }
            return m;
        }
    }
    let vec3 = |key: &str, default: [f64; 3]| -> [f64; 3] {
        n.get(key).and_then(Json::as_arr).map_or(default, |a| {
            [a.first().and_then(Json::as_f64).unwrap_or(default[0]),
             a.get(1).and_then(Json::as_f64).unwrap_or(default[1]),
             a.get(2).and_then(Json::as_f64).unwrap_or(default[2])]
        })
    };
    let t = vec3("translation", [0.0, 0.0, 0.0]);
    let s = vec3("scale", [1.0, 1.0, 1.0]);
    let q = n.get("rotation").and_then(Json::as_arr).map_or([0.0, 0.0, 0.0, 1.0], |a| {
        [a.first().and_then(Json::as_f64).unwrap_or(0.0),
         a.get(1).and_then(Json::as_f64).unwrap_or(0.0),
         a.get(2).and_then(Json::as_f64).unwrap_or(0.0),
         a.get(3).and_then(Json::as_f64).unwrap_or(1.0)]
    });
    mat_from_trs(t, q, s)
}

fn mat_apply(m: &Mat4, p: (f64, f64, f64)) -> (f64, f64, f64) {
    let (x, y, z) = p;
    (
        m[0] * x + m[4] * y + m[8]  * z + m[12],
        m[1] * x + m[5] * y + m[9]  * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    )
}

/// Разбирает GLB-контейнер на JSON-чанк и бинарный чанк.
fn split_glb(bytes: &[u8]) -> Result<(&str, Option<&[u8]>), String> {
    if bytes.len() < 12 {
        return Err("файл слишком мал, чтобы быть GLB".into());
    }
    let magic = u32::from_le_bytes(bytes[0..4].try_into().unwrap());
    if magic != GLB_MAGIC {
        return Err("не GLB-контейнер (нет сигнатуры 'glTF')".into());
    }
    let total_len = u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as usize;
    let limit = total_len.min(bytes.len());

    let mut off = 12usize;
    let mut json_chunk: Option<&[u8]> = None;
    let mut bin_chunk: Option<&[u8]> = None;

    while off + 8 <= limit {
        let clen = u32::from_le_bytes(bytes[off..off + 4].try_into().unwrap()) as usize;
        let ctype = u32::from_le_bytes(bytes[off + 4..off + 8].try_into().unwrap());
        let data_start = off + 8;
        let data_end = (data_start + clen).min(bytes.len());
        let data = &bytes[data_start..data_end];
        match ctype {
            CHUNK_JSON => json_chunk = Some(data),
            CHUNK_BIN => bin_chunk = Some(data),
            _ => {}
        }
        off = data_end;
    }

    let json_bytes = json_chunk.ok_or("в GLB не найден JSON-чанк")?;
    let json_str = std::str::from_utf8(json_bytes).map_err(|_| "JSON-чанк не в UTF-8".to_string())?;
    Ok((json_str, bin_chunk))
}

pub fn glb_to_primitives(bytes: &[u8]) -> Result<Vec<Primitive>, String> {
    let (json_str, bin) = split_glb(bytes)?;
    let root = crate::json::parse(json_str).ok_or("не удалось разобрать glTF JSON")?;

    // ── Буферы ────────────────────────────────────────────────────────────
    let mut buffers: Vec<Vec<u8>> = Vec::new();
    if let Some(arr) = root.get("buffers").and_then(Json::as_arr) {
        for (i, b) in arr.iter().enumerate() {
            if let Some(uri) = b.get("uri").and_then(Json::as_str) {
                if let Some(idx) = uri.find(";base64,") {
                    buffers.push(base64::decode(&uri[idx + 8..]).unwrap_or_default());
                } else {
                    buffers.push(Vec::new()); // внешний файл — не поддерживается
                }
            } else if i == 0 {
                buffers.push(bin.map(|b| b.to_vec()).unwrap_or_default());
            } else {
                buffers.push(Vec::new());
            }
        }
    }

    let empty: Vec<Json> = Vec::new();
    let buffer_views = root.get("bufferViews").and_then(Json::as_arr).unwrap_or(&empty);
    let accessors    = root.get("accessors").and_then(Json::as_arr).unwrap_or(&empty);
    let materials    = root.get("materials").and_then(Json::as_arr).unwrap_or(&empty);
    let images       = root.get("images").and_then(Json::as_arr).unwrap_or(&empty);
    let textures     = root.get("textures").and_then(Json::as_arr).unwrap_or(&empty);
    let meshes       = root.get("meshes").and_then(Json::as_arr).unwrap_or(&empty);
    let nodes        = root.get("nodes").and_then(Json::as_arr).unwrap_or(&empty);

    let read_accessor = |acc_idx: usize| -> Option<Vec<f32>> {
        let acc = accessors.get(acc_idx)?;
        let bv_idx = acc.get("bufferView")?.as_u64()? as usize;
        let bv = buffer_views.get(bv_idx)?;
        let buf_idx = bv.get("buffer")?.as_u64()? as usize;
        let buf = buffers.get(buf_idx)?;
        let bv_offset = bv.get("byteOffset").and_then(Json::as_u64).unwrap_or(0) as usize;
        let acc_offset = acc.get("byteOffset").and_then(Json::as_u64).unwrap_or(0) as usize;
        let stride = bv.get("byteStride").and_then(Json::as_u64).map(|v| v as usize);
        let count = acc.get("count")?.as_u64()? as usize;
        let comp_type = acc.get("componentType")?.as_u64()? as u32;
        let ty = acc.get("type")?.as_str()?;
        let ncomp = match ty { "SCALAR" => 1, "VEC2" => 2, "VEC3" => 3, "VEC4" => 4, _ => return None };
        let comp_size: usize = match comp_type {
            5120 | 5121 => 1,
            5122 | 5123 => 2,
            5125 | 5126 => 4,
            _ => return None,
        };
        let elem_size = comp_size * ncomp;
        let stride = stride.unwrap_or(elem_size);
        let base = bv_offset + acc_offset;

        let mut out = Vec::with_capacity(count * ncomp);
        for i in 0..count {
            let elem_off = base + i * stride;
            for c in 0..ncomp {
                let o = elem_off + c * comp_size;
                if o + comp_size > buf.len() { return None; }
                let v = match comp_type {
                    5126 => f32::from_le_bytes(buf[o..o + 4].try_into().ok()?),
                    5125 => u32::from_le_bytes(buf[o..o + 4].try_into().ok()?) as f32,
                    5123 => u16::from_le_bytes(buf[o..o + 2].try_into().ok()?) as f32,
                    5122 => i16::from_le_bytes(buf[o..o + 2].try_into().ok()?) as f32,
                    5121 => buf[o] as f32,
                    5120 => buf[o] as i8 as f32,
                    _ => return None,
                };
                out.push(v);
            }
        }
        Some(out)
    };

    let material_lookup = |mat_idx: Option<usize>| -> ([u8; 3], Option<String>) {
        let Some(mi) = mat_idx else { return ([200, 200, 200], None) };
        let Some(mat) = materials.get(mi) else { return ([200, 200, 200], None) };
        let pbr = mat.get("pbrMetallicRoughness");
        let mut rgb = [200u8, 200u8, 200u8];
        if let Some(factor) = pbr.and_then(|p| p.get("baseColorFactor")).and_then(Json::as_arr) {
            if factor.len() >= 3 {
                rgb = [
                    (factor[0].as_f64().unwrap_or(0.8) * 255.0).clamp(0.0, 255.0) as u8,
                    (factor[1].as_f64().unwrap_or(0.8) * 255.0).clamp(0.0, 255.0) as u8,
                    (factor[2].as_f64().unwrap_or(0.8) * 255.0).clamp(0.0, 255.0) as u8,
                ];
            }
        }
        let tex = pbr
            .and_then(|p| p.get("baseColorTexture"))
            .and_then(|t| t.get("index"))
            .and_then(Json::as_u64)
            .and_then(|ti| textures.get(ti as usize))
            .and_then(|t| t.get("source"))
            .and_then(Json::as_u64)
            .and_then(|ii| images.get(ii as usize))
            .and_then(|img| {
                if let Some(uri) = img.get("uri").and_then(Json::as_str) {
                    return Some(uri.to_string());
                }
                let bv_idx = img.get("bufferView")?.as_u64()? as usize;
                let bv = buffer_views.get(bv_idx)?;
                let buf_idx = bv.get("buffer")?.as_u64()? as usize;
                let buf = buffers.get(buf_idx)?;
                let off = bv.get("byteOffset").and_then(Json::as_u64).unwrap_or(0) as usize;
                let len = bv.get("byteLength")?.as_u64()? as usize;
                if off + len > buf.len() { return None; }
                let mime = img.get("mimeType").and_then(Json::as_str).unwrap_or("image/png");
                let b64 = base64::encode(&buf[off..off + len]);
                Some(format!("data:{mime};base64,{b64}"))
            });
        (rgb, tex)
    };

    let mut primitives: Vec<Primitive> = Vec::new();

    fn walk(
        idx: usize,
        parent: &Mat4,
        nodes: &[Json],
        meshes: &[Json],
        read_accessor: &dyn Fn(usize) -> Option<Vec<f32>>,
        material_lookup: &dyn Fn(Option<usize>) -> ([u8; 3], Option<String>),
        out: &mut Vec<Primitive>,
    ) {
        let Some(node) = nodes.get(idx) else { return };
        let world = mat_mul(parent, &node_matrix(node));

        if let Some(mesh_idx) = node.get("mesh").and_then(Json::as_u64) {
            if let Some(mesh) = meshes.get(mesh_idx as usize) {
                if let Some(prims) = mesh.get("primitives").and_then(Json::as_arr) {
                    for p in prims {
                        let mode = p.get("mode").and_then(Json::as_u64).unwrap_or(4);
                        if mode != 4 { continue; } // только TRIANGLES
                        let Some(attrs) = p.get("attributes") else { continue };
                        let Some(pos_idx) = attrs.get("POSITION").and_then(Json::as_u64) else { continue };
                        let Some(positions) = read_accessor(pos_idx as usize) else { continue };
                        let vcount = positions.len() / 3;
                        if vcount == 0 { continue; }

                        let uv = attrs.get("TEXCOORD_0")
                            .and_then(Json::as_u64)
                            .and_then(|i| read_accessor(i as usize))
                            .filter(|u| u.len() / 2 == vcount);

                        let indices: Vec<u32> = p.get("indices")
                            .and_then(Json::as_u64)
                            .and_then(|i| read_accessor(i as usize))
                            .map(|v| v.into_iter().map(|f| f as u32).collect())
                            .unwrap_or_else(|| (0..vcount as u32).collect());

                        let mut verts = Vec::with_capacity(vcount);
                        for i in 0..vcount {
                            let (x, y, z) = mat_apply(
                                &world,
                                (positions[i * 3] as f64, positions[i * 3 + 1] as f64, positions[i * 3 + 2] as f64),
                            );
                            // glTF — правая система координат, Y вверх; OMM
                            // использует Y "вниз" (как координаты экрана).
                            verts.push(Vec3 { x, y: -y, z });
                        }

                        let uv = uv.map(|u| (0..vcount).map(|i| (u[i * 2], u[i * 2 + 1])).collect::<Vec<_>>());

                        let mut tris = Vec::with_capacity(indices.len() / 3);
                        for c in indices.chunks_exact(3) {
                            // инверсия Y меняет ориентацию граней — компенсируем порядком вершин.
                            tris.push([c[0], c[2], c[1]]);
                        }
                        if tris.is_empty() { continue; }

                        let mat_idx = p.get("material").and_then(Json::as_u64).map(|v| v as usize);
                        let (rgb, tex) = material_lookup(mat_idx);

                        out.push(Primitive {
                            mesh: MeshData { v: verts, uv, tris },
                            color: rgb,
                            texture: tex,
                        });
                    }
                }
            }
        }

        if let Some(children) = node.get("children").and_then(Json::as_arr) {
            for ch in children {
                if let Some(ci) = ch.as_u64() {
                    walk(ci as usize, &world, nodes, meshes, read_accessor, material_lookup, out);
                }
            }
        }
    }

    let scene_idx = root.get("scene").and_then(Json::as_u64).unwrap_or(0) as usize;
    let root_nodes: Vec<usize> = root.get("scenes").and_then(Json::as_arr)
        .and_then(|s| s.get(scene_idx))
        .and_then(|sc| sc.get("nodes"))
        .and_then(Json::as_arr)
        .map(|a| a.iter().filter_map(Json::as_u64).map(|v| v as usize).collect())
        .unwrap_or_else(|| (0..nodes.len()).collect());

    let ident = identity();
    for ni in root_nodes {
        walk(ni, &ident, nodes, meshes, &read_accessor, &material_lookup, &mut primitives);
    }

    if primitives.is_empty() {
        return Err("в glTF/GLB не найдено треугольных мешей (поддерживается только режим TRIANGLES)".into());
    }
    Ok(primitives)
}

/// Конвертирует байты `.glb` целиком в готовый `.omm`-текст.
pub fn glb_to_omm(bytes: &[u8]) -> Result<String, String> {
    let prims = glb_to_primitives(bytes)?;
    Ok(crate::convert::primitives_to_omm(&prims))
}
