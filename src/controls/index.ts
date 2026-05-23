import type { Camera } from '../types';

export type RenderFn = () => void;

export function initControls(
  canvas: HTMLCanvasElement,
  camera: Camera,
  focal: number,
  isAnimating: () => boolean,
  requestRender: RenderFn,
): void {
  let isDragging = false;
  let dragMode   = 0; // 0 = rotate, 1 = pan
  let lastX = 0, lastY = 0;
  let initialPinchDist: number | null = null;
  let initialZ: number | null = null;

  canvas.style.cursor = 'grab';

  const startDrag = (x: number, y: number, btn: number): void => {
    isDragging = true;
    lastX = x; lastY = y;
    dragMode = btn === 2 || btn === 1 ? 1 : 0;
    canvas.style.cursor = dragMode === 0 ? 'grabbing' : 'move';
  };

  const doDrag = (x: number, y: number): void => {
    if (!isDragging) return;
    const dx = x - lastX, dy = y - lastY;
    lastX = x; lastY = y;
    if (dragMode === 0) {
      camera.ry -= dx * 0.01;
      camera.rx += dy * 0.01;
    } else {
      camera.cx += dx;
      camera.cy += dy;
    }
    if (!isAnimating()) requestRender();
  };

  const endDrag = (): void => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  };

  const clampZ = (): void => {
    if (camera.z < -focal + 10) camera.z = -focal + 10;
  };

  // Mouse
  canvas.addEventListener('mousedown',    e => startDrag(e.clientX, e.clientY, e.button));
  window.addEventListener('mousemove',    e => { if (isDragging) doDrag(e.clientX, e.clientY); });
  window.addEventListener('mouseup',      endDrag);
  canvas.addEventListener('contextmenu',  e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camera.z += e.deltaY * 0.5;
    clampZ();
    if (!isAnimating()) requestRender();
  }, { passive: false });

  // Touch
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY, 0);
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      initialZ = camera.z;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      doDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2 && initialPinchDist != null && initialZ != null) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      camera.z = initialZ * (initialPinchDist / d);
      clampZ();
      if (!isAnimating()) requestRender();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    endDrag();
    initialPinchDist = null;
  });
}
