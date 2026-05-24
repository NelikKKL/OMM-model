import type { OmmObject, Camera, ProjectedPoint } from '../types';
import type { MonoGroup } from '../types';
export declare class Renderer {
    private readonly ctx;
    private readonly canvas;
    readonly focal = 600;
    private cam;
    constructor(canvas: HTMLCanvasElement);
    projectVertex(px: number, py: number, pz: number, cosRx: number, sinRx: number, cosRy: number, sinRy: number, ox: number, oy: number, oz: number, camera: Camera): ProjectedPoint;
    private drawTexturedTriangle;
    private collectFaces;
    private drawFace;
    render(objects: OmmObject[], monoGroups: Record<number, MonoGroup>, camera: Camera): void;
}
