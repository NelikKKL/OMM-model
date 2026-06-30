//! Минимальная реализация base64 (стандартный алфавит, с паддингом).
//! Используется для встраивания бинарной геометрии меша (`mesh3 data(...)`)
//! и текстур glTF прямо в текст `.omm`, без сторонних crate'ов.

const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn encode(data: &[u8]) -> String {
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    let mut chunks = data.chunks_exact(3);

    for c in &mut chunks {
        let n = ((c[0] as u32) << 16) | ((c[1] as u32) << 8) | (c[2] as u32);
        out.push(TABLE[(n >> 18 & 0x3F) as usize] as char);
        out.push(TABLE[(n >> 12 & 0x3F) as usize] as char);
        out.push(TABLE[(n >> 6  & 0x3F) as usize] as char);
        out.push(TABLE[(n       & 0x3F) as usize] as char);
    }

    match chunks.remainder() {
        [a] => {
            let n = (*a as u32) << 16;
            out.push(TABLE[(n >> 18 & 0x3F) as usize] as char);
            out.push(TABLE[(n >> 12 & 0x3F) as usize] as char);
            out.push('=');
            out.push('=');
        }
        [a, b] => {
            let n = ((*a as u32) << 16) | ((*b as u32) << 8);
            out.push(TABLE[(n >> 18 & 0x3F) as usize] as char);
            out.push(TABLE[(n >> 12 & 0x3F) as usize] as char);
            out.push(TABLE[(n >> 6  & 0x3F) as usize] as char);
            out.push('=');
        }
        _ => {}
    }
    out
}

fn val(c: u8) -> Option<u32> {
    match c {
        b'A'..=b'Z' => Some((c - b'A') as u32),
        b'a'..=b'z' => Some((c - b'a' + 26) as u32),
        b'0'..=b'9' => Some((c - b'0' + 52) as u32),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

pub fn decode(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() / 4 * 3);
    let mut buf = [0u32; 4];
    let mut n = 0usize;

    for b in s.bytes() {
        if b.is_ascii_whitespace() { continue; }
        if b == b'=' { break; }
        buf[n] = val(b)?;
        n += 1;
        if n == 4 {
            out.push((buf[0] << 2 | buf[1] >> 4) as u8);
            out.push((buf[1] << 4 | buf[2] >> 2) as u8);
            out.push((buf[2] << 6 | buf[3]) as u8);
            n = 0;
        }
    }
    if n >= 2 {
        out.push((buf[0] << 2 | buf[1] >> 4) as u8);
        if n >= 3 {
            out.push((buf[1] << 4 | buf[2] >> 2) as u8);
        }
    }
    Some(out)
}
