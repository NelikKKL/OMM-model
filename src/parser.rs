use std::collections::HashMap;
use crate::types::{OmmObject, MonoGroup, MonoGroupTransform, ShapeType, AnimationKeyframe};

// ── Public result ─────────────────────────────────────────────────────────────

pub struct ParseResult {
    pub objects:       Vec<OmmObject>,
    pub mono_groups:   HashMap<u32, MonoGroup>,
    pub has_animation: bool,
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub fn parse_omm(txt: &str) -> ParseResult {
    let mut mono_counter: u32 = 0;
    let mut mono_defs: HashMap<u32, MonoGroupTransform> = HashMap::new();

    // Step 1: collapse mono(...) blocks into tagged lines
    let collapsed = preprocess_mono(txt, &mut mono_counter, &mut mono_defs);

    // Step 2: line-by-line parse
    let mut objects:       Vec<OmmObject>          = Vec::new();
    let mut mono_groups:   HashMap<u32, MonoGroup> = HashMap::new();
    let mut has_animation = false;
    let mut current: Option<usize> = None;

    for line in collapsed.lines() {
        let l = line.trim();
        if l.is_empty() || l.starts_with("//") { continue; }

        if let Some(shape) = extract_shape(l) {
            // Scale-Y from colon syntax: "cube3 : 4"
            let sy = extract_colon_divisor(l);
            let mono_id = extract_mono_id(l);

            let idx = objects.len();
            objects.push(OmmObject { shape, sy, ..Default::default() });
            current = Some(idx);

            if let Some(mid) = mono_id {
                mono_groups.entry(mid)
                    .or_insert_with(|| MonoGroup { members: Vec::new() })
                    .members.push(idx);
            }
            continue;
        }

        let Some(idx) = current else { continue };
        parse_props(l, &mut objects[idx], &mut has_animation);
    }

    // Step 3: apply mono group-level transforms
    apply_mono_transforms(&mut objects, &mono_groups, &mono_defs);

    ParseResult { objects, mono_groups, has_animation }
}

// ── Mono block pre-processor ──────────────────────────────────────────────────

fn preprocess_mono(
    txt: &str,
    counter: &mut u32,
    defs: &mut HashMap<u32, MonoGroupTransform>,
) -> String {
    let mut out = String::with_capacity(txt.len() + 64);
    let chars: Vec<char> = txt.chars().collect();
    let n = chars.len();
    let mut i = 0;

    while i < n {
        // Look for "mono" followed by optional whitespace then "("
        if n - i >= 4
            && chars[i]   == 'm' && chars[i+1] == 'o'
            && chars[i+2] == 'n' && chars[i+3] == 'o'
        {
            let mut j = i + 4;
            while j < n && (chars[j] == ' ' || chars[j] == '\t') { j += 1; }
            if j < n && chars[j] == '(' {
                // Find matching ')'
                let content_start = j + 1;
                let mut depth = 1usize;
                let mut k = content_start;
                while k < n && depth > 0 {
                    match chars[k] {
                        '(' => depth += 1,
                        ')' => depth -= 1,
                        _ => {}
                    }
                    if depth > 0 { k += 1; }
                }
                let inner: String = chars[content_start..k].iter().collect();
                let id = *counter;
                *counter += 1;

                let (tagged, gt) = tag_mono_inner(&inner, id);
                defs.insert(id, gt);
                out.push_str(&tagged);
                i = k + 1; // skip closing ')'
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

fn tag_mono_inner(inner: &str, id: u32) -> (String, MonoGroupTransform) {
    let mut gt = MonoGroupTransform::new();
    let mut shape_found = false;
    let mut tagged = String::with_capacity(inner.len() + 32);

    for line in inner.lines() {
        let t = line.trim();
        if t.is_empty() || t.starts_with("//") {
            tagged.push('\n');
            continue;
        }

        let is_shape = extract_shape(t).is_some();

        if !shape_found && !is_shape {
            // Parse group-level transforms
            let mut pos = 0;
            while let Some((key, val, end)) = next_prop(t, pos) {
                let v = parse_f64(val);
                match key {
                    "x"     => gt.x     = v,
                    "y"     => gt.y     = v,
                    "z"     => gt.z     = v,
                    "scale" => gt.scale = v,
                    "rr"    => gt.ry    = v.to_radians(),
                    "ru"    => gt.rx    = v.to_radians(),
                    _       => {}
                }
                pos = end;
            }
            tagged.push('\n'); // erase group-transform line
            continue;
        }

        if is_shape {
            shape_found = true;
            tagged.push_str(t);
            tagged.push_str(&format!(" __mono({})", id));
            tagged.push('\n');
        } else {
            tagged.push_str(line);
            tagged.push('\n');
        }
    }

    (tagged, gt)
}

fn apply_mono_transforms(
    objects:     &mut Vec<OmmObject>,
    mono_groups: &HashMap<u32, MonoGroup>,
    defs:        &HashMap<u32, MonoGroupTransform>,
) {
    for (id, def) in defs {
        let Some(group) = mono_groups.get(id) else { continue };
        let cos_ry = def.ry.cos(); let sin_ry = def.ry.sin();
        let cos_rx = def.rx.cos(); let sin_rx = def.rx.sin();

        for &obj_idx in &group.members {
            let obj = &mut objects[obj_idx];
            obj.s *= def.scale;
            let (lx, ly, lz) = (obj.x, obj.y, obj.z);
            let rx1 =  lx * cos_ry + lz * sin_ry;
            let rz1 = -lx * sin_ry + lz * cos_ry;
            let ry1 =  ly * cos_rx - rz1 * sin_rx;
            let rz2 =  ly * sin_rx + rz1 * cos_rx;
            obj.x  = rx1 * def.scale + def.x;
            obj.y  = ry1 * def.scale + def.y;
            obj.z  = rz2 * def.scale + def.z;
            obj.rx += def.rx;
            obj.ry += def.ry;
        }
    }
}

// ── Property parser ───────────────────────────────────────────────────────────

fn parse_props(line: &str, obj: &mut OmmObject, has_anim: &mut bool) {
    let mut pos = 0;
    while let Some((key, val, end)) = next_prop(line, pos) {
        match key {
            "x"     => obj.x   = parse_f64(val),
            "y"     => obj.y   = parse_f64(val),
            "z"     => obj.z   = parse_f64(val),
            "scale" => obj.s  *= parse_f64(val),
            "rr"    => obj.ry  = parse_f64(val).to_radians(),
            "ru"    => obj.rx  = parse_f64(val).to_radians(),
            "color" => {
                let clean: String = val.chars().filter(|c| !c.is_whitespace()).collect();
                let parts: Vec<&str> = clean.split(',').collect();
                if parts.len() >= 3 {
                    obj.rgb = [
                        parse_u8(parts[0]),
                        parse_u8(parts[1]),
                        parse_u8(parts[2]),
                    ];
                }
            }
            "texture"   => obj.tex_src = Some(val.trim().to_string()),
            "ur"        => obj.ur = parse_f64(val),
            "ul"        => obj.ul = parse_f64(val),
            "ug"        => obj.ug = parse_f64(val),
            "um"        => obj.um = parse_f64(val),
            "ud"        => obj.ud = parse_f64(val),
            "uu"        => obj.uu = parse_f64(val),
            "animation" => {
                obj.anim = Some(parse_animation_frames(val));
                *has_anim = true;
            }
            _ => {}
        }
        pos = end;
    }
}

fn parse_animation_frames(raw: &str) -> Vec<AnimationKeyframe> {
    raw.split(',').map(parse_anim_kv).collect()
}

fn parse_anim_kv(s: &str) -> AnimationKeyframe {
    let mut kf = AnimationKeyframe::default();
    let bytes = s.as_bytes();
    let n = bytes.len();
    let mut i = 0;

    while i < n {
        // skip non-alpha
        while i < n && !bytes[i].is_ascii_alphabetic() { i += 1; }
        if i >= n { break; }

        // read key
        let ks = i;
        while i < n && bytes[i].is_ascii_alphabetic() { i += 1; }
        let key = &s[ks..i];

        // read numeric value (with optional leading minus)
        let vs = i;
        if i < n && bytes[i] == b'-' { i += 1; }
        while i < n && (bytes[i].is_ascii_digit() || bytes[i] == b'.') { i += 1; }
        if i == vs { continue; }
        let v: f64 = s[vs..i].parse().unwrap_or(0.0);

        match key {
            "x"  => kf.x  = Some(v),
            "y"  => kf.y  = Some(v),
            "z"  => kf.z  = Some(v),
            "rr" => kf.rr = Some(v),
            "ru" => kf.ru = Some(v),
            _    => {}
        }
    }
    kf
}

// ── String helpers ────────────────────────────────────────────────────────────

const SHAPES: &[&str] = &[
    "image3", "cube3", "pyramid3", "triangle3", "sphere3", "cylinder3",
];

fn extract_shape(s: &str) -> Option<ShapeType> {
    for &name in SHAPES {
        if s.starts_with(name) {
            let after = &s[name.len()..];
            if after.is_empty()
                || after.starts_with([' ', '\t', ':'])
                || after.starts_with("__mono")
            {
                return ShapeType::from_str(name);
            }
        }
    }
    None
}

fn extract_colon_divisor(s: &str) -> f64 {
    if let Some(pos) = s.find(':') {
        let after = s[pos + 1..].trim();
        let num: f64 = after
            .split_whitespace()
            .next()
            .and_then(|t| t.parse().ok())
            .unwrap_or(1.0);
        if num != 0.0 { return 1.0 / num; }
    }
    1.0
}

fn extract_mono_id(s: &str) -> Option<u32> {
    const MARKER: &str = "__mono(";
    let pos = s.find(MARKER)?;
    let after = &s[pos + MARKER.len()..];
    let end = after.find(')')?;
    after[..end].parse().ok()
}

/// Returns (key, value, end_position) for the next `ident(value)` token.
pub fn next_prop(s: &str, start: usize) -> Option<(&str, &str, usize)> {
    let bytes = s.as_bytes();
    let n = bytes.len();
    let mut i = start;

    loop {
        // skip to next ascii letter or underscore
        while i < n && !bytes[i].is_ascii_alphabetic() && bytes[i] != b'_' { i += 1; }
        if i >= n { return None; }

        let ks = i;
        while i < n && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_') { i += 1; }
        let ke = i;

        // skip spaces then check for '('
        while i < n && bytes[i] == b' ' { i += 1; }
        if i >= n || bytes[i] != b'(' { continue; } // not a call, scan further
        i += 1; // skip '('

        let vs = i;
        while i < n && bytes[i] != b')' { i += 1; }
        if i >= n { return None; }

        return Some((&s[ks..ke], &s[vs..i], i + 1));
    }
}

fn parse_f64(s: &str) -> f64 {
    s.trim().parse().unwrap_or(0.0)
}

fn parse_u8(s: &str) -> u8 {
    s.trim().parse::<i32>().unwrap_or(0).clamp(0, 255) as u8
}
