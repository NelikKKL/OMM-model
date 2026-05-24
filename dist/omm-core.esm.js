/*!
 * omm-core — ultra-lightweight 3D canvas engine
 * License MIT | Author NelikKKL
 */
// ── Pre-compiled regexes ───────────────────────────────────────────────────────
const RE_SHAPE = /^(image3|cube3|pyramid3|triangle3|sphere3|cylinder3)/;
const RE_MONO_ID = /__mono\((\d+)\)/;
const RE_MONO_BLOCK = /mono\s*\(([\s\S]*?)\)/g;
const RE_PROPS = /(\w+)\(([^)]*)\)/g;
const RE_ANIM_KV = /([a-z]+)(-?[\d.]+)/g;
function defaultObject() {
    return {
        type: 'cube',
        x: 0, y: 0, z: 0,
        s: 50, sy: 1,
        rx: 0, ry: 0,
        col: '200,200,200',
        rgb: [200, 200, 200],
        tex: null,
        ur: 0, ul: 0, ug: 0, um: 0, ud: 0, uu: 0,
        monoId: null,
        anim: null,
        animIndex: 0,
        animSpeed: 2.0,
    };
}
function parseOMM(txt, getImg) {
    const objects = [];
    const monoGroups = {};
    let hasAnimation = false;
    let monoCounter = 0;
    const monoGroupDefs = {};
    // Pre-process mono(...) blocks
    RE_MONO_BLOCK.lastIndex = 0;
    const collapsed = txt.replace(RE_MONO_BLOCK, (_, inner) => {
        const id = monoCounter++;
        const gt = { x: 0, y: 0, z: 0, rx: 0, ry: 0, scale: 1 };
        let shapeFound = false;
        const lines = inner.split('\n');
        const out = lines.map(line => {
            const t = line.trim();
            if (!t || t.startsWith('//'))
                return line;
            const isShape = RE_SHAPE.test(t);
            if (!shapeFound && !isShape) {
                RE_PROPS.lastIndex = 0;
                let m;
                while ((m = RE_PROPS.exec(t)) !== null) {
                    const v = parseFloat(m[2]);
                    switch (m[1]) {
                        case 'x':
                            gt.x = v;
                            break;
                        case 'y':
                            gt.y = v;
                            break;
                        case 'z':
                            gt.z = v;
                            break;
                        case 'scale':
                            gt.scale = v;
                            break;
                        case 'rr':
                            gt.ry = v * Math.PI / 180;
                            break;
                        case 'ru':
                            gt.rx = v * Math.PI / 180;
                            break;
                    }
                }
                return '';
            }
            if (isShape) {
                shapeFound = true;
                return `${t} __mono(${id})`;
            }
            return line;
        });
        monoGroupDefs[id] = gt;
        return out.join('\n');
    });
    const lines = collapsed.split('\n');
    let current = null;
    for (const line of lines) {
        const l = line.trim();
        if (!l || l.startsWith('//'))
            continue;
        const shapeMatch = RE_SHAPE.exec(l);
        if (shapeMatch) {
            const typeStr = shapeMatch[1];
            let sy = 1;
            const colonIdx = l.indexOf(':');
            if (colonIdx !== -1)
                sy = 1 / parseFloat(l.slice(colonIdx + 1));
            const monoMatch = RE_MONO_ID.exec(l);
            const monoId = monoMatch ? parseInt(monoMatch[1], 10) : null;
            current = Object.assign(Object.assign({}, defaultObject()), { type: typeStr.slice(0, -1), sy,
                monoId });
            if (monoId !== null) {
                if (!monoGroups[monoId])
                    monoGroups[monoId] = { members: [] };
                monoGroups[monoId].members.push(current);
            }
            objects.push(current);
        }
        if (!current)
            continue;
        RE_PROPS.lastIndex = 0;
        let m;
        while ((m = RE_PROPS.exec(l)) !== null) {
            const k = m[1], raw = m[2];
            switch (k) {
                case 'x':
                    current.x = parseFloat(raw);
                    break;
                case 'y':
                    current.y = parseFloat(raw);
                    break;
                case 'z':
                    current.z = parseFloat(raw);
                    break;
                case 'scale':
                    current.s *= parseFloat(raw);
                    break;
                case 'rr':
                    current.ry = parseFloat(raw) * Math.PI / 180;
                    break;
                case 'ru':
                    current.rx = parseFloat(raw) * Math.PI / 180;
                    break;
                case 'color': {
                    current.col = raw.replace(/\s/g, '');
                    const p = current.col.split(',');
                    current.rgb = [parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10)];
                    break;
                }
                case 'texture':
                    current.tex = getImg(raw.trim());
                    break;
                case 'ur':
                    current.ur = parseFloat(raw);
                    break;
                case 'ul':
                    current.ul = parseFloat(raw);
                    break;
                case 'ug':
                    current.ug = parseFloat(raw);
                    break;
                case 'um':
                    current.um = parseFloat(raw);
                    break;
                case 'ud':
                    current.ud = parseFloat(raw);
                    break;
                case 'uu':
                    current.uu = parseFloat(raw);
                    break;
                case 'animation': {
                    current.anim = [];
                    const frames = raw.split(',');
                    for (const frame of frames) {
                        const kf = {};
                        RE_ANIM_KV.lastIndex = 0;
                        let am;
                        while ((am = RE_ANIM_KV.exec(frame)) !== null) {
                            kf[am[1]] = parseFloat(am[2]);
                        }
                        current.anim.push(kf);
                    }
                    hasAnimation = true;
                    break;
                }
            }
        }
    }
    // Apply mono group-level transforms
    for (const id in monoGroupDefs) {
        const gt = monoGroupDefs[id];
        const group = monoGroups[id];
        if (!group)
            continue;
        const cosRy = Math.cos(gt.ry), sinRy = Math.sin(gt.ry);
        const cosRx = Math.cos(gt.rx), sinRx = Math.sin(gt.rx);
        for (const obj of group.members) {
            obj.s *= gt.scale;
            const { x: lx, y: ly, z: lz } = obj;
            const rx1 = lx * cosRy + lz * sinRy;
            const rz1 = -lx * sinRy + lz * cosRy;
            const ry1 = ly * cosRx - rz1 * sinRx;
            const rz2 = ly * sinRx + rz1 * cosRx;
            obj.x = rx1 * gt.scale + gt.x;
            obj.y = ry1 * gt.scale + gt.y;
            obj.z = rz2 * gt.scale + gt.z;
            obj.rx += gt.rx;
            obj.ry += gt.ry;
        }
    }
    return { objects, monoGroups, hasAnimation };
}

// ── Static geometry (normalized, s=1) — built once, reused every frame ────────
const CUBE_V = [
    { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 },
];
const CUBE_F = [
    [0, 1, 2, 3], [4, 5, 6, 7],
    [0, 1, 5, 4], [2, 3, 7, 6],
    [0, 3, 7, 4], [1, 2, 6, 5],
];
const PYRAMID_V = [
    { x: 0, y: -1, z: 0 }, { x: -1, y: 1, z: -1 },
    { x: 1, y: 1, z: -1 }, { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 },
];
const PYRAMID_F = [
    [0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [4, 3, 2, 1],
];
const TRIANGLE_V = [
    { x: 0, y: -1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 },
];
const TRIANGLE_F = [[0, 1, 2]];
const IMAGE_V = [
    { x: -1, y: -1, z: 0 }, { x: 1, y: -1, z: 0 },
    { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 },
];
// ── Cached procedural geometry ────────────────────────────────────────────────
const GEO_CACHE = {};
function buildSphereGeo() {
    if (GEO_CACHE.sphere)
        return GEO_CACHE.sphere;
    const LAT = 8, LON = 8;
    const v = [];
    const faces = [];
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
function buildCylinderGeo() {
    if (GEO_CACHE.cylinder)
        return GEO_CACHE.cylinder;
    const SEG = 10;
    const v = [];
    const faces = [];
    for (let i = 0; i < SEG; i++) {
        const theta = (i * Math.PI * 2) / SEG;
        const cx = Math.cos(theta), cz = Math.sin(theta);
        v.push({ x: cx, y: -1, z: cz });
        v.push({ x: cx, y: 1, z: cz });
    }
    v.push({ x: 0, y: -1, z: 0 }); // top cap centre
    v.push({ x: 0, y: 1, z: 0 }); // bottom cap centre
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

class Renderer {
    constructor(canvas) {
        this.focal = 600;
        this.cam = { srx: 0, crx: 1, sry: 0, cry: 1 };
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }
    // ── Projection ───────────────────────────────────────────────────────────────
    projectVertex(px, py, pz, cosRx, sinRx, cosRy, sinRy, ox, oy, oz, camera) {
        // Object rotation
        let ty = py * cosRx - pz * sinRx;
        let tz = py * sinRx + pz * cosRx;
        let tx = px * cosRy + tz * sinRy;
        tz = -px * sinRy + tz * cosRy;
        tx += ox;
        ty += oy;
        tz += oz;
        // Camera rotation (pre-cached per frame)
        const { srx, crx, sry, cry } = this.cam;
        const ry = ty * crx - tz * srx;
        let rz = ty * srx + tz * crx;
        const rx = tx * cry + rz * sry;
        rz = -tx * sry + rz * cry;
        const sc = this.focal / (this.focal + rz + camera.z);
        return {
            x: rx * sc + this.canvas.width * 0.5 + camera.cx,
            y: ry * sc + this.canvas.height * 0.5 + camera.cy,
            z: rz,
        };
    }
    // ── Textured triangle ────────────────────────────────────────────────────────
    drawTexturedTriangle(p1, p2, p3, u1, v1, u2, v2, u3, v3, img) {
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.clip();
        const det = (u2 - u1) * (v3 - v1) - (u3 - u1) * (v2 - v1);
        const idet = 1 / det;
        const m11 = ((p2.x - p1.x) * (v3 - v1) - (p3.x - p1.x) * (v2 - v1)) * idet;
        const m12 = ((p2.y - p1.y) * (v3 - v1) - (p3.y - p1.y) * (v2 - v1)) * idet;
        const m21 = ((p3.x - p1.x) * (u2 - u1) - (p2.x - p1.x) * (u3 - u1)) * idet;
        const m22 = ((p3.y - p1.y) * (u2 - u1) - (p2.y - p1.y) * (u3 - u1)) * idet;
        ctx.setTransform(m11, m12, m21, m22, p1.x - m11 * u1 - m21 * v1, p1.y - m12 * u1 - m22 * v1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
    }
    // ── Collect all projected faces from one object ───────────────────────────
    collectFaces(obj, camera) {
        var _a;
        const { type } = obj;
        let rawV, faces;
        switch (type) {
            case 'cube':
                rawV = CUBE_V;
                faces = CUBE_F;
                break;
            case 'pyramid':
                rawV = PYRAMID_V;
                faces = PYRAMID_F;
                break;
            case 'triangle':
                rawV = TRIANGLE_V;
                faces = TRIANGLE_F;
                break;
            case 'sphere': {
                const g = buildSphereGeo();
                rawV = g.v;
                faces = g.faces;
                break;
            }
            case 'cylinder': {
                const g = buildCylinderGeo();
                rawV = g.v;
                faces = g.faces;
                break;
            }
            case 'image':
                rawV = IMAGE_V;
                faces = null;
                break;
            default: return [];
        }
        const s = obj.s, sy = s * obj.sy;
        const cosRx = Math.cos(obj.rx), sinRx = Math.sin(obj.rx);
        const cosRy = Math.cos(obj.ry), sinRy = Math.sin(obj.ry);
        const hasDeform = obj.ur || obj.ul || obj.ug || obj.um || obj.ud || obj.uu;
        const pts = rawV.map(rv => {
            let vx = rv.x * s, vy = rv.y * sy, vz = rv.z * s;
            if (hasDeform) {
                if (vx > 0)
                    vx = (vx / s) * (s + obj.ur);
                else if (vx < 0)
                    vx = (vx / s) * (s + obj.ul);
                if (vy > 0 && sy)
                    vy = (vy / sy) * (sy + obj.ud);
                else if (vy < 0 && sy)
                    vy = (vy / sy) * (sy + obj.uu);
                if (vz > 0)
                    vz = (vz / s) * (s + obj.ug);
                else if (vz < 0)
                    vz = (vz / s) * (s + obj.um);
            }
            return this.projectVertex(vx, vy, vz, cosRx, sinRx, cosRy, sinRy, obj.x, obj.y, obj.z, camera);
        });
        // Image: special case — two triangles, not in the face list
        if (type === 'image') {
            if (!((_a = obj.tex) === null || _a === void 0 ? void 0 : _a.complete))
                return [];
            // Return as drawable faces with a special marker (faceIndex = -1)
            const zAvg1 = (pts[0].z + pts[1].z + pts[2].z) / 3;
            const zAvg2 = (pts[0].z + pts[2].z + pts[3].z) / 3;
            return [
                { pts, f: [0, 1, 2], z: zAvg1, obj, faceIndex: -1, totalFaces: 1 },
                { pts, f: [0, 2, 3], z: zAvg2, obj, faceIndex: -2, totalFaces: 1 },
            ];
        }
        const result = [];
        const nf = faces.length;
        for (let i = 0; i < nf; i++) {
            const f = faces[i];
            let zSum = 0;
            for (const k of f)
                zSum += pts[k].z;
            result.push({ pts, f, z: zSum / f.length, obj, faceIndex: i, totalFaces: nf });
        }
        return result;
    }
    // ── Draw a single face ────────────────────────────────────────────────────
    drawFace(fd) {
        var _a, _b;
        const { pts, f, obj } = fd;
        const ctx = this.ctx;
        const p1 = pts[f[0]], p2 = pts[f[1]], p3 = pts[f[2]];
        const hasTex = (_b = (_a = obj.tex) === null || _a === void 0 ? void 0 : _a.complete) !== null && _b !== void 0 ? _b : false;
        // Image faces
        if (fd.faceIndex === -1) {
            if (hasTex) {
                const tw = obj.tex.width, th = obj.tex.height;
                this.drawTexturedTriangle(p1, p2, p3, 0, 0, tw, 0, tw, th, obj.tex);
            }
            return;
        }
        if (fd.faceIndex === -2) {
            if (hasTex) {
                const tw = obj.tex.width, th = obj.tex.height;
                this.drawTexturedTriangle(p1, p3, pts[f[2]], 0, 0, tw, th, 0, th, obj.tex);
            }
            return;
        }
        if (hasTex) {
            const tw = obj.tex.width, th = obj.tex.height;
            if (f.length === 4) {
                const p4 = pts[f[3]];
                this.drawTexturedTriangle(p1, p2, p3, 0, 0, tw, 0, tw, th, obj.tex);
                this.drawTexturedTriangle(p1, p3, p4, 0, 0, tw, th, 0, th, obj.tex);
            }
            else {
                this.drawTexturedTriangle(p1, p2, p3, tw * 0.5, 0, tw, th, 0, th, obj.tex);
            }
        }
        else {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            if (f.length === 4)
                ctx.lineTo(pts[f[3]].x, pts[f[3]].y);
            ctx.closePath();
            // Face shading (index-based approximation)
            const { faceIndex: fi, totalFaces: nf } = fd;
            const type = obj.type;
            let sh;
            if (type === 'sphere')
                sh = 0.8 + (fi % 8) * 0.05;
            else if (type === 'cylinder')
                sh = 0.85 + (fi % 10) * 0.04;
            else
                sh = 0.85 + (fi % nf) * 0.05;
            if (sh > 1)
                sh = 1;
            const rgb = obj.rgb;
            ctx.fillStyle = `rgb(${rgb[0] * sh | 0},${rgb[1] * sh | 0},${rgb[2] * sh | 0})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.stroke();
        }
    }
    // ── Main render ──────────────────────────────────────────────────────────────
    render(objects, monoGroups, camera) {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.clearRect(0, 0, W, H);
        // Cache camera trig once per frame
        this.cam.srx = Math.sin(camera.rx);
        this.cam.crx = Math.cos(camera.rx);
        this.cam.sry = Math.sin(camera.ry);
        this.cam.cry = Math.cos(camera.ry);
        // Collect ALL faces from ALL objects into one flat list
        const allFaces = [];
        for (const obj of objects) {
            const faces = this.collectFaces(obj, camera);
            for (const f of faces)
                allFaces.push(f);
        }
        // Global depth sort: back-to-front (painter's algorithm per triangle)
        allFaces.sort((a, b) => b.z - a.z);
        // Draw all faces in depth order
        for (const fd of allFaces) {
            this.drawFace(fd);
        }
    }
}

function initControls(canvas, camera, focal, isAnimating, requestRender) {
    let isDragging = false;
    let dragMode = 0; // 0 = rotate, 1 = pan
    let lastX = 0, lastY = 0;
    let initialPinchDist = null;
    let initialZ = null;
    canvas.style.cursor = 'grab';
    const startDrag = (x, y, btn) => {
        isDragging = true;
        lastX = x;
        lastY = y;
        dragMode = btn === 2 || btn === 1 ? 1 : 0;
        canvas.style.cursor = dragMode === 0 ? 'grabbing' : 'move';
    };
    const doDrag = (x, y) => {
        if (!isDragging)
            return;
        const dx = x - lastX, dy = y - lastY;
        lastX = x;
        lastY = y;
        if (dragMode === 0) {
            camera.ry -= dx * 0.01;
            camera.rx += dy * 0.01;
        }
        else {
            camera.cx += dx;
            camera.cy += dy;
        }
        if (!isAnimating())
            requestRender();
    };
    const endDrag = () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    };
    const clampZ = () => {
        if (camera.z < -focal + 10)
            camera.z = -focal + 10;
    };
    // Mouse
    canvas.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY, e.button));
    window.addEventListener('mousemove', e => { if (isDragging)
        doDrag(e.clientX, e.clientY); });
    window.addEventListener('mouseup', endDrag);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        camera.z += e.deltaY * 0.5;
        clampZ();
        if (!isAnimating())
            requestRender();
    }, { passive: false });
    // Touch
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        if (e.touches.length === 1) {
            startDrag(e.touches[0].clientX, e.touches[0].clientY, 0);
        }
        else if (e.touches.length === 2) {
            isDragging = false;
            initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            initialZ = camera.z;
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            doDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
        else if (e.touches.length === 2 && initialPinchDist != null && initialZ != null) {
            const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            camera.z = initialZ * (initialPinchDist / d);
            clampZ();
            if (!isAnimating())
                requestRender();
        }
    }, { passive: false });
    canvas.addEventListener('touchend', () => {
        endDrag();
        initialPinchDist = null;
    });
}

const ROT_SPEED = 0.05;
function stepAnimation(objects) {
    for (const obj of objects) {
        if (!obj.anim || obj.anim.length === 0)
            continue;
        const target = obj.anim[obj.animIndex];
        const speed = obj.animSpeed;
        const tx = target.x !== undefined ? target.x : obj.x;
        const ty = target.y !== undefined ? target.y : obj.y;
        const tz = target.z !== undefined ? target.z : obj.z;
        const trx = target.ru !== undefined ? target.ru * Math.PI / 180 : obj.rx;
        const tryR = target.rr !== undefined ? target.rr * Math.PI / 180 : obj.ry;
        const dx = tx - obj.x, dy = ty - obj.y, dz = tz - obj.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > speed) {
            const inv = speed / dist;
            obj.x += dx * inv;
            obj.y += dy * inv;
            obj.z += dz * inv;
        }
        else {
            obj.x = tx;
            obj.y = ty;
            obj.z = tz;
        }
        const drx = trx - obj.rx;
        const dry = tryR - obj.ry;
        obj.rx = Math.abs(drx) > ROT_SPEED ? obj.rx + Math.sign(drx) * ROT_SPEED : trx;
        obj.ry = Math.abs(dry) > ROT_SPEED ? obj.ry + Math.sign(dry) * ROT_SPEED : tryR;
        const arrived = dist <= speed &&
            Math.abs(drx) <= ROT_SPEED &&
            Math.abs(dry) <= ROT_SPEED;
        if (arrived) {
            if (++obj.animIndex >= obj.anim.length)
                obj.animIndex = 0;
        }
    }
}

class OmmModel extends HTMLElement {
    constructor() {
        super();
        this.camera = { z: 600, rx: 0.4, ry: 0.4, cx: 0, cy: 0 };
        this.objects = [];
        this.monoGroups = {};
        this.textures = {};
        this.isAnimating = false;
        this.animationRequested = false;
        this.attachShadow({ mode: 'open' });
        this.canvas = document.createElement('canvas');
        this.renderer = new Renderer(this.canvas);
        this.shadowRoot.appendChild(this.canvas);
    }
    connectedCallback() {
        this.canvas.style.cssText = 'width:100%;height:100%;display:block';
        if (this.hasAttribute('freer')) {
            initControls(this.canvas, this.camera, this.renderer.focal, () => this.isAnimating, () => this.render());
        }
        setTimeout(() => { this.resize(); this.loadContent(); }, 50);
    }
    async loadContent() {
        var _a;
        const content = this.getAttribute('src') || ((_a = this.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
        if (content.endsWith('.omm')) {
            try {
                const res = await fetch(content);
                if (res.ok)
                    this.parse(await res.text());
                else
                    console.error(`OMM: failed to load ${content}`);
            }
            catch (e) {
                console.error('OMM:', e);
            }
        }
        else {
            this.parse(content);
        }
        if (this.hasAttribute('autorate') || this.isAnimating) {
            this.isAnimating = true;
            if (!this.animationRequested) {
                this.animationRequested = true;
                this.tick();
            }
        }
        else {
            this.render();
        }
    }
    resize() {
        this.canvas.width = this.offsetWidth || 300;
        this.canvas.height = this.offsetHeight || 300;
    }
    parse(txt) {
        const { objects, monoGroups, hasAnimation } = parseOMM(txt, src => this.getImg(src));
        this.objects = objects;
        this.monoGroups = monoGroups;
        this.isAnimating = hasAnimation;
        this.render();
    }
    getImg(src) {
        if (this.textures[src])
            return this.textures[src];
        const img = new Image();
        img.src = src;
        img.onload = () => this.render();
        return (this.textures[src] = img);
    }
    render() {
        this.renderer.render(this.objects, this.monoGroups, this.camera);
    }
    tick() {
        if (!this.isAnimating)
            return;
        if (this.hasAttribute('autorate'))
            this.camera.ry += 0.01;
        stepAnimation(this.objects);
        this.render();
        requestAnimationFrame(() => this.tick());
    }
}
customElements.define('omm-model', OmmModel);

export { OmmModel };
