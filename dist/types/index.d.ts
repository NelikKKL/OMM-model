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
    x: number;
    y: number;
    z: number;
    s: number;
    sy: number;
    rx: number;
    ry: number;
    col: string;
    rgb: [number, number, number];
    tex: HTMLImageElement | null;
    ur: number;
    ul: number;
    ug: number;
    um: number;
    ud: number;
    uu: number;
    monoId: number | null;
    anim: AnimationKeyframe[] | null;
    animIndex: number;
    animSpeed: number;
}
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
