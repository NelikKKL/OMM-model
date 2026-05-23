import type { OmmObject } from '../types';

const ROT_SPEED = 0.05;

export function stepAnimation(objects: OmmObject[]): void {
  for (const obj of objects) {
    if (!obj.anim || obj.anim.length === 0) continue;

    const target = obj.anim[obj.animIndex];
    const speed  = obj.animSpeed;

    const tx   = target.x  !== undefined ? target.x                     : obj.x;
    const ty   = target.y  !== undefined ? target.y                     : obj.y;
    const tz   = target.z  !== undefined ? target.z                     : obj.z;
    const trx  = target.ru !== undefined ? target.ru * Math.PI / 180    : obj.rx;
    const tryR = target.rr !== undefined ? target.rr * Math.PI / 180    : obj.ry;

    const dx = tx - obj.x, dy = ty - obj.y, dz = tz - obj.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > speed) {
      const inv = speed / dist;
      obj.x += dx * inv; obj.y += dy * inv; obj.z += dz * inv;
    } else {
      obj.x = tx; obj.y = ty; obj.z = tz;
    }

    const drx  = trx  - obj.rx;
    const dry  = tryR - obj.ry;
    obj.rx = Math.abs(drx) > ROT_SPEED ? obj.rx + Math.sign(drx) * ROT_SPEED : trx;
    obj.ry = Math.abs(dry) > ROT_SPEED ? obj.ry + Math.sign(dry) * ROT_SPEED : tryR;

    const arrived =
      dist <= speed &&
      Math.abs(drx) <= ROT_SPEED &&
      Math.abs(dry) <= ROT_SPEED;

    if (arrived) {
      if (++obj.animIndex >= obj.anim.length) obj.animIndex = 0;
    }
  }
}
