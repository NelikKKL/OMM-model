//! Импорт сторонних 3D-форматов в синтаксис `.omm`.
//!
//! Каждый конвертер превращает исходный файл в один или несколько блоков
//! `mesh3`, геометрия которых упакована компактно в base64 (`data(...)`,
//! см. `crate::mesh::MeshData::pack`). Получившийся текст можно сразу
//! скормить `OmmEngine::parse`, либо сохранить как обычный `.omm`-файл.

pub mod gltf;
pub mod obj;

use crate::base64;
use crate::mesh::MeshData;

/// Один импортированный объект: геометрия + базовый цвет + (опционально)
/// текстура — внешняя ссылка или встроенный data-URI.
pub struct Primitive {
    pub mesh:    MeshData,
    pub color:   [u8; 3],
    pub texture: Option<String>,
}

pub fn primitives_to_omm(prims: &[Primitive]) -> String {
    let mut out = String::new();
    for p in prims {
        out.push_str("mesh3\n");
        out.push_str(&format!("data({})\n", base64::encode(&p.mesh.pack())));
        out.push_str(&format!("color({}, {}, {})\n", p.color[0], p.color[1], p.color[2]));
        if let Some(tex) = &p.texture {
            out.push_str(&format!("texture({tex})\n"));
        }
        out.push('\n');
    }
    out
}
