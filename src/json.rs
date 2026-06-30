//! Крошечный JSON-парсер «как есть» — нужен только для чтения JSON-чанка
//! glTF/GLB. Не претендует на полное соответствие RFC 8259 (например,
//! не отличает int/float), но корректно разбирает произвольную вложенную
//! структуру объектов/массивов/строк/чисел, которой достаточно для glTF.

use std::collections::BTreeMap;

#[derive(Debug, Clone)]
pub enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(BTreeMap<String, Json>),
}

impl Json {
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self { Json::Obj(m) => m.get(key), _ => None }
    }
    pub fn as_f64(&self) -> Option<f64> { if let Json::Num(n) = self { Some(*n) } else { None } }
    pub fn as_u64(&self) -> Option<u64> { self.as_f64().map(|n| n.max(0.0) as u64) }
    pub fn as_str(&self) -> Option<&str> { if let Json::Str(s) = self { Some(s) } else { None } }
    pub fn as_arr(&self) -> Option<&Vec<Json>> { if let Json::Arr(a) = self { Some(a) } else { None } }
}

pub fn parse(s: &str) -> Option<Json> {
    let b = s.as_bytes();
    let mut i = 0usize;
    let v = parse_value(b, &mut i)?;
    Some(v)
}

fn skip_ws(b: &[u8], i: &mut usize) {
    while *i < b.len() && (b[*i] as char).is_whitespace() { *i += 1; }
}

fn parse_value(b: &[u8], i: &mut usize) -> Option<Json> {
    skip_ws(b, i);
    match *b.get(*i)? {
        b'{' => parse_obj(b, i),
        b'[' => parse_arr(b, i),
        b'"' => parse_str(b, i).map(Json::Str),
        b't' => { if b[*i..].starts_with(b"true")  { *i += 4; Some(Json::Bool(true)) } else { None } }
        b'f' => { if b[*i..].starts_with(b"false") { *i += 5; Some(Json::Bool(false)) } else { None } }
        b'n' => { if b[*i..].starts_with(b"null")  { *i += 4; Some(Json::Null) } else { None } }
        _    => parse_num(b, i),
    }
}

fn parse_obj(b: &[u8], i: &mut usize) -> Option<Json> {
    *i += 1; // {
    let mut m = BTreeMap::new();
    skip_ws(b, i);
    if b.get(*i) == Some(&b'}') { *i += 1; return Some(Json::Obj(m)); }
    loop {
        skip_ws(b, i);
        let key = parse_str(b, i)?;
        skip_ws(b, i);
        if b.get(*i) != Some(&b':') { return None; }
        *i += 1;
        let val = parse_value(b, i)?;
        m.insert(key, val);
        skip_ws(b, i);
        match b.get(*i) {
            Some(b',') => { *i += 1; }
            Some(b'}') => { *i += 1; break; }
            _ => return None,
        }
    }
    Some(Json::Obj(m))
}

fn parse_arr(b: &[u8], i: &mut usize) -> Option<Json> {
    *i += 1; // [
    let mut a = Vec::new();
    skip_ws(b, i);
    if b.get(*i) == Some(&b']') { *i += 1; return Some(Json::Arr(a)); }
    loop {
        let val = parse_value(b, i)?;
        a.push(val);
        skip_ws(b, i);
        match b.get(*i) {
            Some(b',') => { *i += 1; }
            Some(b']') => { *i += 1; break; }
            _ => return None,
        }
    }
    Some(Json::Arr(a))
}

fn parse_str(b: &[u8], i: &mut usize) -> Option<String> {
    if b.get(*i) != Some(&b'"') { return None; }
    *i += 1;
    let mut s = String::new();
    while *i < b.len() {
        let c = b[*i];
        if c == b'"' { *i += 1; return Some(s); }
        if c == b'\\' {
            *i += 1;
            let e = *b.get(*i)?;
            match e {
                b'"'  => s.push('"'),
                b'\\' => s.push('\\'),
                b'/'  => s.push('/'),
                b'n'  => s.push('\n'),
                b't'  => s.push('\t'),
                b'r'  => s.push('\r'),
                b'b'  => s.push('\u{8}'),
                b'f'  => s.push('\u{c}'),
                b'u'  => {
                    let hex = std::str::from_utf8(b.get(*i + 1..*i + 5)?).ok()?;
                    let cp  = u32::from_str_radix(hex, 16).ok()?;
                    s.push(char::from_u32(cp).unwrap_or('?'));
                    *i += 4;
                }
                _ => {}
            }
            *i += 1;
        } else {
            let len = utf8_len(c);
            let end = (*i + len).min(b.len());
            if let Ok(chunk) = std::str::from_utf8(&b[*i..end]) {
                s.push_str(chunk);
            }
            *i = end;
        }
    }
    None
}

fn utf8_len(b0: u8) -> usize {
    if b0 & 0x80 == 0 { 1 }
    else if b0 & 0xE0 == 0xC0 { 2 }
    else if b0 & 0xF0 == 0xE0 { 3 }
    else if b0 & 0xF8 == 0xF0 { 4 }
    else { 1 }
}

fn parse_num(b: &[u8], i: &mut usize) -> Option<Json> {
    let start = *i;
    if b.get(*i) == Some(&b'-') { *i += 1; }
    while *i < b.len() && (b[*i].is_ascii_digit() || matches!(b[*i], b'.' | b'e' | b'E' | b'+' | b'-')) {
        *i += 1;
    }
    if *i == start { return None; }
    let s = std::str::from_utf8(&b[start..*i]).ok()?;
    s.parse::<f64>().ok().map(Json::Num)
}
