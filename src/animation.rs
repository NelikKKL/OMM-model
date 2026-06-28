use crate::types::OmmObject;
use std::f64::consts::PI;

const ROT_SPEED: f64 = 0.05;

pub fn step_animation(objects: &mut Vec<OmmObject>) {
    for obj in objects.iter_mut() {
        // Early-out: no animation or empty keyframe list
        let anim_len = obj.anim.as_ref().map_or(0, |a| a.len());
        if anim_len == 0 { continue; }

        // Snapshot target values so we release the borrow before mutating obj
        let (tx, ty, tz, trx, try_) = {
            let anim  = obj.anim.as_ref().unwrap();
            let frame = &anim[obj.anim_index];
            (
                frame.x .unwrap_or(obj.x),
                frame.y .unwrap_or(obj.y),
                frame.z .unwrap_or(obj.z),
                frame.ru.map(|v| v * PI / 180.0).unwrap_or(obj.rx),
                frame.rr.map(|v| v * PI / 180.0).unwrap_or(obj.ry),
            )
        }; // borrow on obj.anim ends here

        let speed = obj.anim_speed;
        let dx    = tx - obj.x;
        let dy    = ty - obj.y;
        let dz    = tz - obj.z;
        let dist  = (dx * dx + dy * dy + dz * dz).sqrt();

        if dist > speed {
            let inv = speed / dist;
            obj.x += dx * inv;
            obj.y += dy * inv;
            obj.z += dz * inv;
        } else {
            obj.x = tx; obj.y = ty; obj.z = tz;
        }

        let drx = trx  - obj.rx;
        let dry = try_ - obj.ry;
        obj.rx = if drx.abs() > ROT_SPEED { obj.rx + drx.signum() * ROT_SPEED } else { trx };
        obj.ry = if dry.abs() > ROT_SPEED { obj.ry + dry.signum() * ROT_SPEED } else { try_ };

        let arrived = dist <= speed
            && drx.abs() <= ROT_SPEED
            && dry.abs() <= ROT_SPEED;

        if arrived {
            obj.anim_index = (obj.anim_index + 1) % anim_len;
        }
    }
}
