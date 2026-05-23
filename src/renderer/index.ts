import type { OmmObject, Camera, CameraTrigCache, ProjectedPoint, Face } from '../types';
import type { MonoGroup } from '../types';
import {
  CUBE_V, CUBE_F, PYRAMID_V, PYRAMID_F,
  TRIANGLE_V, TRIANGLE_F, IMAGE_V,
  buildSphereGeo, buildCylinderGeo,
} from '../geometry';

interface DrawableFace {
  pts: ProjectedPoint[];
  f: number[];           // indices into pts[]
  z: number;             // average Z for sorting
  obj: OmmObject;
  faceIndex: number;
  totalFaces: number;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  readonly focal = 600;
  private cam: CameraTrigCache = { srx: 0, crx: 1, sry: 0, cry: 1 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  // ── Projection ───────────────────────────────────────────────────────────────

  projectVertex(
    px: number, py: number, pz: number,
    cosRx: number, sinRx: number,
    cosRy: number, sinRy: number,
    ox: number, oy: number, oz: number,
    camera: Camera,
  ): ProjectedPoint {
    // Object rotation
    let ty = py * cosRx - pz * sinRx;
    let tz = py * sinRx + pz * cosRx;
    let tx = px * cosRy + tz * sinRy;
    tz      = -px * sinRy + tz * cosRy;
    tx += ox; ty += oy; tz += oz;

    // Camera rotation (pre-cached per frame)
    const { srx, crx, sry, cry } = this.cam;
    const ry = ty * crx - tz * srx;
    let rz   = ty * srx + tz * crx;
    const rx = tx * cry + rz * sry;
    rz        = -tx * sry + rz * cry;

    const sc = this.focal / (this.focal + rz + camera.z);
    return {
      x: rx * sc + this.canvas.width  * 0.5 + camera.cx,
      y: ry * sc + this.canvas.height * 0.5 + camera.cy,
      z: rz,
    };
  }

  // ── Textured triangle ────────────────────────────────────────────────────────

  private drawTexturedTriangle(
    p1: ProjectedPoint, p2: ProjectedPoint, p3: ProjectedPoint,
    u1: number, v1: number, u2: number, v2: number, u3: number, v3: number,
    img: HTMLImageElement,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.clip();

    const det  = (u2 - u1) * (v3 - v1) - (u3 - u1) * (v2 - v1);
    const idet = 1 / det;
    const m11 = ((p2.x - p1.x) * (v3 - v1) - (p3.x - p1.x) * (v2 - v1)) * idet;
    const m12 = ((p2.y - p1.y) * (v3 - v1) - (p3.y - p1.y) * (v2 - v1)) * idet;
    const m21 = ((p3.x - p1.x) * (u2 - u1) - (p2.x - p1.x) * (u3 - u1)) * idet;
    const m22 = ((p3.y - p1.y) * (u2 - u1) - (p2.y - p1.y) * (u3 - u1)) * idet;

    ctx.setTransform(
      m11, m12, m21, m22,
      p1.x - m11 * u1 - m21 * v1,
      p1.y - m12 * u1 - m22 * v1,
    );
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // ── Collect all projected faces from one object ───────────────────────────

  private collectFaces(obj: OmmObject, camera: Camera): DrawableFace[] {
    const { type } = obj;
    let rawV, faces: Face[] | null;

    switch (type) {
      case 'cube':     rawV = CUBE_V;     faces = CUBE_F;     break;
      case 'pyramid':  rawV = PYRAMID_V;  faces = PYRAMID_F;  break;
      case 'triangle': rawV = TRIANGLE_V; faces = TRIANGLE_F; break;
      case 'sphere':   { const g = buildSphereGeo();   rawV = g.v; faces = g.faces; break; }
      case 'cylinder': { const g = buildCylinderGeo(); rawV = g.v; faces = g.faces; break; }
      case 'image':    rawV = IMAGE_V; faces = null; break;
      default: return [];
    }

    const s = obj.s, sy = s * obj.sy;
    const cosRx = Math.cos(obj.rx), sinRx = Math.sin(obj.rx);
    const cosRy = Math.cos(obj.ry), sinRy = Math.sin(obj.ry);
    const hasDeform = obj.ur || obj.ul || obj.ug || obj.um || obj.ud || obj.uu;

    const pts: ProjectedPoint[] = rawV.map(rv => {
      let vx = rv.x * s, vy = rv.y * sy, vz = rv.z * s;

      if (hasDeform) {
        if (vx > 0)             vx = (vx / s)  * (s  + obj.ur);
        else if (vx < 0)        vx = (vx / s)  * (s  + obj.ul);
        if (vy > 0 && sy)       vy = (vy / sy) * (sy + obj.ud);
        else if (vy < 0 && sy)  vy = (vy / sy) * (sy + obj.uu);
        if (vz > 0)             vz = (vz / s)  * (s  + obj.ug);
        else if (vz < 0)        vz = (vz / s)  * (s  + obj.um);
      }

      return this.projectVertex(vx, vy, vz, cosRx, sinRx, cosRy, sinRy, obj.x, obj.y, obj.z, camera);
    });

    // Image: special case — two triangles, not in the face list
    if (type === 'image') {
      if (!obj.tex?.complete) return [];
      // Return as drawable faces with a special marker (faceIndex = -1)
      const zAvg1 = (pts[0].z + pts[1].z + pts[2].z) / 3;
      const zAvg2 = (pts[0].z + pts[2].z + pts[3].z) / 3;
      return [
        { pts, f: [0, 1, 2], z: zAvg1, obj, faceIndex: -1, totalFaces: 1 },
        { pts, f: [0, 2, 3], z: zAvg2, obj, faceIndex: -2, totalFaces: 1 },
      ];
    }

    const result: DrawableFace[] = [];
    const nf = faces!.length;
    for (let i = 0; i < nf; i++) {
      const f = faces![i];
      let zSum = 0;
      for (const k of f) zSum += pts[k].z;
      result.push({ pts, f, z: zSum / f.length, obj, faceIndex: i, totalFaces: nf });
    }
    return result;
  }

  // ── Draw a single face ────────────────────────────────────────────────────

  private drawFace(fd: DrawableFace): void {
    const { pts, f, obj } = fd;
    const ctx = this.ctx;

    const p1 = pts[f[0]], p2 = pts[f[1]], p3 = pts[f[2]];
    const hasTex = obj.tex?.complete ?? false;

    // Image faces
    if (fd.faceIndex === -1) {
      if (hasTex) {
        const tw = obj.tex!.width, th = obj.tex!.height;
        this.drawTexturedTriangle(p1, p2, p3, 0, 0, tw, 0, tw, th, obj.tex!);
      }
      return;
    }
    if (fd.faceIndex === -2) {
      if (hasTex) {
        const tw = obj.tex!.width, th = obj.tex!.height;
        this.drawTexturedTriangle(p1, p3, pts[f[2]], 0, 0, tw, th, 0, th, obj.tex!);
      }
      return;
    }

    if (hasTex) {
      const tw = obj.tex!.width, th = obj.tex!.height;
      if (f.length === 4) {
        const p4 = pts[f[3]];
        this.drawTexturedTriangle(p1, p2, p3,       0,    0,  tw,   0, tw, th, obj.tex!);
        this.drawTexturedTriangle(p1, p3, p4,       0,    0,  tw,  th,  0, th, obj.tex!);
      } else {
        this.drawTexturedTriangle(p1, p2, p3, tw * 0.5, 0, tw, th,  0, th, obj.tex!);
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      if (f.length === 4) ctx.lineTo(pts[f[3]].x, pts[f[3]].y);
      ctx.closePath();

      // Face shading (index-based approximation)
      const { faceIndex: fi, totalFaces: nf } = fd;
      const type = obj.type;
      let sh: number;
      if      (type === 'sphere')   sh = 0.8  + (fi % 8)  * 0.05;
      else if (type === 'cylinder') sh = 0.85 + (fi % 10) * 0.04;
      else                          sh = 0.85 + (fi % nf) * 0.05;
      if (sh > 1) sh = 1;

      const rgb = obj.rgb;
      ctx.fillStyle   = `rgb(${rgb[0] * sh | 0},${rgb[1] * sh | 0},${rgb[2] * sh | 0})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.stroke();
    }
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  render(
    objects: OmmObject[],
    monoGroups: Record<number, MonoGroup>,
    camera: Camera,
  ): void {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Cache camera trig once per frame
    this.cam.srx = Math.sin(camera.rx);
    this.cam.crx = Math.cos(camera.rx);
    this.cam.sry = Math.sin(camera.ry);
    this.cam.cry = Math.cos(camera.ry);

    // Collect ALL faces from ALL objects into one flat list
    const allFaces: DrawableFace[] = [];
    for (const obj of objects) {
      const faces = this.collectFaces(obj, camera);
      for (const f of faces) allFaces.push(f);
    }

    // Global depth sort: back-to-front (painter's algorithm per triangle)
    allFaces.sort((a, b) => b.z - a.z);

    // Draw all faces in depth order
    for (const fd of allFaces) {
      this.drawFace(fd);
    }
  }
}
