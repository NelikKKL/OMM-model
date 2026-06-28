use crate::types::{Vec3, Face, Geometry};
use std::f64::consts::PI;

// ── Static geometry (normalized) ──────────────────────────────────────────────

pub fn cube_v() -> Vec<Vec3> {
    vec![
        Vec3 { x: -1.0, y: -1.0, z: -1.0 },
        Vec3 { x:  1.0, y: -1.0, z: -1.0 },
        Vec3 { x:  1.0, y:  1.0, z: -1.0 },
        Vec3 { x: -1.0, y:  1.0, z: -1.0 },
        Vec3 { x: -1.0, y: -1.0, z:  1.0 },
        Vec3 { x:  1.0, y: -1.0, z:  1.0 },
        Vec3 { x:  1.0, y:  1.0, z:  1.0 },
        Vec3 { x: -1.0, y:  1.0, z:  1.0 },
    ]
}

pub fn cube_f() -> Vec<Face> {
    vec![
        vec![0, 1, 2, 3], vec![4, 5, 6, 7],
        vec![0, 1, 5, 4], vec![2, 3, 7, 6],
        vec![0, 3, 7, 4], vec![1, 2, 6, 5],
    ]
}

pub fn pyramid_v() -> Vec<Vec3> {
    vec![
        Vec3 { x:  0.0, y: -1.0, z:  0.0 },
        Vec3 { x: -1.0, y:  1.0, z: -1.0 },
        Vec3 { x:  1.0, y:  1.0, z: -1.0 },
        Vec3 { x:  1.0, y:  1.0, z:  1.0 },
        Vec3 { x: -1.0, y:  1.0, z:  1.0 },
    ]
}

pub fn pyramid_f() -> Vec<Face> {
    vec![
        vec![0, 2, 1], vec![0, 3, 2], vec![0, 4, 3], vec![0, 1, 4],
        vec![4, 3, 2, 1],
    ]
}

pub fn triangle_v() -> Vec<Vec3> {
    vec![
        Vec3 { x:  0.0, y: -1.0, z: 0.0 },
        Vec3 { x:  1.0, y:  1.0, z: 0.0 },
        Vec3 { x: -1.0, y:  1.0, z: 0.0 },
    ]
}

pub fn triangle_f() -> Vec<Face> {
    vec![vec![0, 1, 2]]
}

pub fn image_v() -> Vec<Vec3> {
    vec![
        Vec3 { x: -1.0, y: -1.0, z: 0.0 },
        Vec3 { x:  1.0, y: -1.0, z: 0.0 },
        Vec3 { x:  1.0, y:  1.0, z: 0.0 },
        Vec3 { x: -1.0, y:  1.0, z: 0.0 },
    ]
}

// ── Procedural geometry ───────────────────────────────────────────────────────

pub fn build_sphere_geo() -> Geometry {
    const LAT: usize = 8;
    const LON: usize = 8;
    let mut v: Vec<Vec3> = Vec::with_capacity((LAT + 1) * (LON + 1));
    let mut faces: Vec<Face> = Vec::with_capacity(LAT * LON * 2);

    for la in 0..=LAT {
        let theta = (la as f64 * PI) / LAT as f64;
        let sin_t = theta.sin();
        let cos_t = theta.cos();
        for lo in 0..=LON {
            let phi = (lo as f64 * 2.0 * PI) / LON as f64;
            v.push(Vec3 {
                x: phi.cos() * sin_t,
                y: cos_t,
                z: phi.sin() * sin_t,
            });
        }
    }

    for la in 0..LAT {
        for lo in 0..LON {
            let f   = la * (LON + 1) + lo;
            let s2  = f + LON + 1;
            faces.push(vec![f, s2, f + 1]);
            faces.push(vec![s2, s2 + 1, f + 1]);
        }
    }

    Geometry { v, faces }
}

pub fn build_cylinder_geo() -> Geometry {
    const SEG: usize = 10;
    let mut v: Vec<Vec3> = Vec::with_capacity(SEG * 2 + 2);
    let mut faces: Vec<Face> = Vec::with_capacity(SEG * 3);

    for i in 0..SEG {
        let theta = (i as f64 * PI * 2.0) / SEG as f64;
        v.push(Vec3 { x: theta.cos(), y: -1.0, z: theta.sin() }); // bottom ring
        v.push(Vec3 { x: theta.cos(), y:  1.0, z: theta.sin() }); // top ring
    }

    let tc = v.len(); v.push(Vec3 { x: 0.0, y: -1.0, z: 0.0 }); // bottom cap
    let bc = v.len(); v.push(Vec3 { x: 0.0, y:  1.0, z: 0.0 }); // top cap

    for i in 0..SEG {
        let ct = i * 2;
        let cb = ct + 1;
        let nt = ((i + 1) % SEG) * 2;
        let nb = nt + 1;
        faces.push(vec![ct, nt, nb, cb]);
        faces.push(vec![tc, ct, nt]);
        faces.push(vec![bc, nb, cb]);
    }

    Geometry { v, faces }
}
