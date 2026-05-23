// ── Geometry ──────────────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
}

export type Face = number[];

export interface Geometry {
  v: Vec3[];
  faces: Face[];
}

// ── Object model ──────────────────────────────────────────────────────────────

export type ShapeType = 'cube' | 'pyramid' | 'triangle' | 'sphere' | 'cylinder' | 'image';

export interface AnimationKeyframe {
  x?: number;
  y?: number;
  z?: number;
  rr?: number;
  ru?: number;
}

export interface OmmObject {
  type: ShapeType;
  // Position
  x: number;
  y: number;
  z: number;
  // Scale
  s: number;
  sy: number;
  // Rotation (radians)
  rx: number;
  ry: number;
  // Color
  col: string;
  rgb: [number, number, number];
  // Texture
  tex: HTMLImageElement | null;
  // Asymmetric deform
  ur: number;
  ul: number;
  ug: number;
  um: number;
  ud: number;
  uu: number;
  // Mono group
  monoId: number | null;
  // Animation
  anim: AnimationKeyframe[] | null;
  animIndex: number;
  animSpeed: number;
}

// ── Mono group ────────────────────────────────────────────────────────────────

export interface MonoGroupTransform {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  scale: number;
}

export interface MonoGroup {
  members: OmmObject[];
}

// ── Camera ────────────────────────────────────────────────────────────────────

export interface Camera {
  z: number;
  rx: number;
  ry: number;
  cx: number;
  cy: number;
}

export interface CameraTrigCache {
  srx: number;
  crx: number;
  sry: number;
  cry: number;
}
