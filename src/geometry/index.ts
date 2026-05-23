import type { Vec3, Face, Geometry } from '../types';

// ── Static geometry (normalized, s=1) — built once, reused every frame ────────

export const CUBE_V: Vec3[] = [
  { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
  { x:  1, y:  1, z: -1 }, { x: -1, y:  1, z: -1 },
  { x: -1, y: -1, z:  1 }, { x: 1, y: -1, z:  1 },
  { x:  1, y:  1, z:  1 }, { x: -1, y:  1, z:  1 },
];

export const CUBE_F: Face[] = [
  [0, 1, 2, 3], [4, 5, 6, 7],
  [0, 1, 5, 4], [2, 3, 7, 6],
  [0, 3, 7, 4], [1, 2, 6, 5],
];

export const PYRAMID_V: Vec3[] = [
  { x: 0, y: -1, z:  0 }, { x: -1, y: 1, z: -1 },
  { x: 1, y:  1, z: -1 }, { x:  1, y: 1, z:  1 },
  { x: -1, y: 1, z:  1 },
];

export const PYRAMID_F: Face[] = [
  [0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [4, 3, 2, 1],
];

export const TRIANGLE_V: Vec3[] = [
  { x: 0, y: -1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 },
];

export const TRIANGLE_F: Face[] = [[0, 1, 2]];

export const IMAGE_V: Vec3[] = [
  { x: -1, y: -1, z: 0 }, { x: 1, y: -1, z: 0 },
  { x:  1, y:  1, z: 0 }, { x: -1, y:  1, z: 0 },
];

// ── Cached procedural geometry ────────────────────────────────────────────────

const GEO_CACHE: Partial<Record<'sphere' | 'cylinder', Geometry>> = {};

export function buildSphereGeo(): Geometry {
  if (GEO_CACHE.sphere) return GEO_CACHE.sphere;

  const LAT = 8, LON = 8;
  const v: Vec3[] = [];
  const faces: Face[] = [];

  for (let la = 0; la <= LAT; la++) {
    const theta = (la * Math.PI) / LAT;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let lo = 0; lo <= LON; lo++) {
      const phi = (lo * 2 * Math.PI) / LON;
      v.push({ x: Math.cos(phi) * sinT, y: cosT, z: Math.sin(phi) * sinT });
    }
  }

  for (let la = 0; la < LAT; la++) {
    for (let lo = 0; lo < LON; lo++) {
      const f = la * (LON + 1) + lo;
      const s2 = f + LON + 1;
      faces.push([f, s2, f + 1]);
      faces.push([s2, s2 + 1, f + 1]);
    }
  }

  return (GEO_CACHE.sphere = { v, faces });
}

export function buildCylinderGeo(): Geometry {
  if (GEO_CACHE.cylinder) return GEO_CACHE.cylinder;

  const SEG = 10;
  const v: Vec3[] = [];
  const faces: Face[] = [];

  for (let i = 0; i < SEG; i++) {
    const theta = (i * Math.PI * 2) / SEG;
    const cx = Math.cos(theta), cz = Math.sin(theta);
    v.push({ x: cx, y: -1, z: cz });
    v.push({ x: cx, y:  1, z: cz });
  }

  v.push({ x: 0, y: -1, z: 0 }); // top cap centre
  v.push({ x: 0, y:  1, z: 0 }); // bottom cap centre

  const tc = v.length - 2, bc = v.length - 1;

  for (let i = 0; i < SEG; i++) {
    const ct = i * 2, cb = ct + 1;
    const nt = ((i + 1) % SEG) * 2, nb = nt + 1;
    faces.push([ct, nt, nb, cb]);
    faces.push([tc, ct, nt]);
    faces.push([bc, nb, cb]);
  }

  return (GEO_CACHE.cylinder = { v, faces });
}
