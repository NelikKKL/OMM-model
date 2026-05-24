import type { Camera } from '../types';
export type RenderFn = () => void;
export declare function initControls(canvas: HTMLCanvasElement, camera: Camera, focal: number, isAnimating: () => boolean, requestRender: RenderFn): void;
