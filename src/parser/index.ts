import type {
  OmmObject, MonoGroup, MonoGroupTransform, ShapeType,
} from '../types';

// ── Pre-compiled regexes ───────────────────────────────────────────────────────
const RE_SHAPE      = /^(image3|cube3|pyramid3|triangle3|sphere3|cylinder3)/;
const RE_MONO_ID    = /__mono\((\d+)\)/;
const RE_MONO_BLOCK = /mono\s*\(([\s\S]*?)\)/g;
const RE_PROPS      = /(\w+)\(([^)]*)\)/g;
const RE_ANIM_KV    = /([a-z]+)(-?[\d.]+)/g;

export interface ParseResult {
  objects: OmmObject[];
  monoGroups: Record<number, MonoGroup>;
  hasAnimation: boolean;
}

function defaultObject(): OmmObject {
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

export function parseOMM(
  txt: string,
  getImg: (src: string) => HTMLImageElement,
): ParseResult {
  const objects: OmmObject[] = [];
  const monoGroups: Record<number, MonoGroup> = {};
  let hasAnimation = false;
  let monoCounter = 0;
  const monoGroupDefs: Record<number, MonoGroupTransform> = {};

  // Pre-process mono(...) blocks
  RE_MONO_BLOCK.lastIndex = 0;
  const collapsed = txt.replace(RE_MONO_BLOCK, (_, inner: string) => {
    const id = monoCounter++;
    const gt: MonoGroupTransform = { x: 0, y: 0, z: 0, rx: 0, ry: 0, scale: 1 };
    let shapeFound = false;

    const lines = inner.split('\n');
    const out = lines.map(line => {
      const t = line.trim();
      if (!t || t.startsWith('//')) return line;

      const isShape = RE_SHAPE.test(t);
      if (!shapeFound && !isShape) {
        RE_PROPS.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = RE_PROPS.exec(t)) !== null) {
          const v = parseFloat(m[2]);
          switch (m[1]) {
            case 'x':     gt.x = v; break;
            case 'y':     gt.y = v; break;
            case 'z':     gt.z = v; break;
            case 'scale': gt.scale = v; break;
            case 'rr':    gt.ry = v * Math.PI / 180; break;
            case 'ru':    gt.rx = v * Math.PI / 180; break;
          }
        }
        return '';
      }

      if (isShape) { shapeFound = true; return `${t} __mono(${id})`; }
      return line;
    });

    monoGroupDefs[id] = gt;
    return out.join('\n');
  });

  const lines = collapsed.split('\n');
  let current: OmmObject | null = null;

  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith('//')) continue;

    const shapeMatch = RE_SHAPE.exec(l);
    if (shapeMatch) {
      const typeStr = shapeMatch[1];
      let sy = 1;
      const colonIdx = l.indexOf(':');
      if (colonIdx !== -1) sy = 1 / parseFloat(l.slice(colonIdx + 1));

      const monoMatch = RE_MONO_ID.exec(l);
      const monoId = monoMatch ? parseInt(monoMatch[1], 10) : null;

      current = {
        ...defaultObject(),
        type: typeStr.slice(0, -1) as ShapeType,
        sy,
        monoId,
      };

      if (monoId !== null) {
        if (!monoGroups[monoId]) monoGroups[monoId] = { members: [] };
        monoGroups[monoId].members.push(current);
      }
      objects.push(current);
    }

    if (!current) continue;

    RE_PROPS.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_PROPS.exec(l)) !== null) {
      const k = m[1], raw = m[2];
      switch (k) {
        case 'x':       current.x   = parseFloat(raw); break;
        case 'y':       current.y   = parseFloat(raw); break;
        case 'z':       current.z   = parseFloat(raw); break;
        case 'scale':   current.s  *= parseFloat(raw); break;
        case 'rr':      current.ry  = parseFloat(raw) * Math.PI / 180; break;
        case 'ru':      current.rx  = parseFloat(raw) * Math.PI / 180; break;
        case 'color': {
          current.col = raw.replace(/\s/g, '');
          const p = current.col.split(',');
          current.rgb = [parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10)];
          break;
        }
        case 'texture': current.tex = getImg(raw.trim()); break;
        case 'ur': current.ur = parseFloat(raw); break;
        case 'ul': current.ul = parseFloat(raw); break;
        case 'ug': current.ug = parseFloat(raw); break;
        case 'um': current.um = parseFloat(raw); break;
        case 'ud': current.ud = parseFloat(raw); break;
        case 'uu': current.uu = parseFloat(raw); break;
        case 'animation': {
          current.anim = [];
          const frames = raw.split(',');
          for (const frame of frames) {
            const kf: Record<string, number> = {};
            RE_ANIM_KV.lastIndex = 0;
            let am: RegExpExecArray | null;
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
    const group = monoGroups[id as unknown as number];
    if (!group) continue;

    const cosRy = Math.cos(gt.ry), sinRy = Math.sin(gt.ry);
    const cosRx = Math.cos(gt.rx), sinRx = Math.sin(gt.rx);

    for (const obj of group.members) {
      obj.s *= gt.scale;
      const { x: lx, y: ly, z: lz } = obj;
      const rx1 =  lx * cosRy + lz * sinRy;
      const rz1 = -lx * sinRy + lz * cosRy;
      const ry1 =  ly * cosRx - rz1 * sinRx;
      const rz2 =  ly * sinRx + rz1 * cosRx;
      obj.x  = rx1 * gt.scale + gt.x;
      obj.y  = ry1 * gt.scale + gt.y;
      obj.z  = rz2 * gt.scale + gt.z;
      obj.rx += gt.rx;
      obj.ry += gt.ry;
    }
  }

  return { objects, monoGroups, hasAnimation };
}
