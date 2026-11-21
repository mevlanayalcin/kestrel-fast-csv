#![no_std]
#![allow(clippy::missing_safety_doc)]

use core::arch::wasm32::{
    u8x16_bitmask, u8x16_eq, unreachable, v128, v128_load, v128_or, v128_store,
};
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    unreachable()
}

extern "C" {
    static __heap_base: u8;
}

const RET_DONE: i32 = 0;
const RET_NEED_MORE: i32 = 1;
const RET_FLUSH: i32 = 2;
const RET_GROW_OUT: i32 = 3;
const RET_GROW_ERR: i32 = 4;
const RET_GROW_EXTRA: i32 = 5;
const RET_UNREADABLE: i32 = -1;

const E_STRAY: u32 = 0;
const E_JUNK: u32 = 1;
const E_UNTERM: u32 = 2;
const E_SHORT: u32 = 3;
const E_LONG: u32 = 4;

const ENDED_EOL: u32 = 1;
const ENDED_EOF: u32 = 2;

const JUNK_COMMA: u32 = 0;
const JUNK_EOL: u32 = 1;
const JUNK_EOF: u32 = 2;
const JUNK_MORE: u32 = 3;

#[repr(C, align(16))]
struct SimdConsts {
    comma: [u8; 16],
    bslash: [u8; 16],
    quote: [u8; 16],
}

static SIMD_CONSTS: SimdConsts = SimdConsts {
    comma: [b','; 16],
    bslash: [b'\\'; 16],
    quote: [b'"'; 16],
};

#[repr(C, align(64))]
struct State {
    in_base: u32,    // [0]
    sentinel: u32,   // [1]
    in_len: u32,     // [2]
    out_base: u32,   // [3]
    out_cap: u32,    // [4]
    out_limit: u32,  // [5]
    err_base: u32,   // [6]
    err_cap: u32,    // [7]
    extra_base: u32, // [8]
    extra_cap: u32,  // [9]

    i: u32,          // [10]
    o: u32,          // [11]
    line: u32,       // [12]
    kept: u32,       // [13]
    width: i32,      // [14]
    nerr: u32,       // [15]
    nextras: u32,    // [16]
    rec0_end: i32,   // [17]
    need_out: u32,   // [18]
    need_extra: u32, // [19]

    // Internal cold scratch (kept out of Liftoff's hot GP register file!)
    rec_ip: u32,
    rec_op: u32,
    rec_nerr: u32,
    rec_line: u32,
    open_ip: u32,
    open_line: u32,
    field_start: u32,
    first_quoted: u32,
    sent_ptr: u32,
    out_limit_ptr: u32,
    status: i32,
}

static mut S: State = State {
    in_base: 0,
    sentinel: 0,
    in_len: 0,
    out_base: 0,
    out_cap: 0,
    out_limit: 0,
    err_base: 0,
    err_cap: 0,
    extra_base: 0,
    extra_cap: 0,
    i: 0,
    o: 0,
    line: 1,
    kept: 0,
    width: -1,
    nerr: 0,
    nextras: 0,
    rec0_end: -1,
    need_out: 0,
    need_extra: 0,
    rec_ip: 0,
    rec_op: 0,
    rec_nerr: 0,
    rec_line: 1,
    open_ip: 0,
    open_line: 1,
    field_start: 0,
    first_quoted: 0,
    sent_ptr: 0,
    out_limit_ptr: 0,
    status: 0,
};

#[inline(always)]
unsafe fn read_u16(p: *const u8) -> u16 {
    (p as *const u16).read_unaligned()
}

#[inline(always)]
unsafe fn read_u32(p: *const u8) -> u32 {
    (p as *const u32).read_unaligned()
}

#[inline(always)]
unsafe fn write_u16(p: *mut u8, v: u16) {
    (p as *mut u16).write_unaligned(v);
}

#[inline(always)]
unsafe fn write_u32(p: *mut u8, v: u32) {
    (p as *mut u32).write_unaligned(v);
}

#[cold]
#[inline(never)]
unsafe fn hex4(p: *const u8) -> i32 {
    let mut v = 0i32;
    let mut k = 2usize;
    while k < 6 {
        let c = *p.add(k);
        let d = if c.wrapping_sub(b'0') <= 9 {
            (c - b'0') as i32
        } else if c.wrapping_sub(b'a') <= 5 {
            (c - b'a' + 10) as i32
        } else if c.wrapping_sub(b'A') <= 5 {
            (c - b'A' + 10) as i32
        } else {
            return -1;
        };
        v = (v << 4) | d;
        k += 1;
    }
    v
}

#[cold]
#[inline(never)]
unsafe fn push_err(code: u32, line: u32, rec: u32, a: u32, b: u32) -> bool {
    let n = S.nerr;
    if n >= S.err_cap {
        S.status = RET_GROW_ERR;
        return false;
    }
    let p = (S.err_base as *mut u32).add((n as usize) * 5);
    *p = code;
    *p.add(1) = line;
    *p.add(2) = rec;
    *p.add(3) = a;
    *p.add(4) = b;
    S.nerr = n + 1;
    true
}

#[cold]
#[inline(never)]
unsafe fn copy_escape(ip: *const u8, op: *mut u8) -> u32 {
    let e = *ip.add(1);
    if e == b'u' {
        let v = hex4(ip);
        if v < 0 || v == 0x0a || v == 0x0d || v == 0x22 || v == 0x2c {
            S.status = RET_UNREADABLE;
            return 0;
        }
        write_u32(op, read_u32(ip));
        write_u16(op.add(4), read_u16(ip.add(4)));
        6
    } else if e == b'"' || e == b'\\' || e == b'/' || e == b'b' || e == b'f' || e == b't' {
        write_u16(op, read_u16(ip));
        2
    } else {
        S.status = RET_UNREADABLE;
        0
    }
}

#[cold]
#[inline(never)]
unsafe fn handle_stray_cr(mut ip: *const u8) -> *const u8 {
    if !push_err(E_STRAY, S.rec_line, S.kept, 0, 0) {
        return ip;
    }
    ip = ip.add(2);
    if read_u16(ip) == 0x755C && hex4(ip) == 0x0a {
        S.status = RET_UNREADABLE;
    }
    ip
}

#[cold]
#[inline(never)]
unsafe fn handle_junk(mut ip: *const u8, mut op: *mut u8, sent8_ptr: *const u8) -> u32 {
    let from = op;
    let sent_ptr = S.sent_ptr as *const u8;
    let rec = S.kept;
    loop {
        let c = *ip;
        if c == b',' {
            if op > from {
                push_err(E_JUNK, S.rec_line, rec, 0, 0);
            }
            S.i = ip as u32;
            S.o = op as u32;
            return JUNK_COMMA;
        }
        if c == b'"' {
            if ip >= sent_ptr {
                S.i = ip as u32;
                S.o = op as u32;
                return JUNK_MORE;
            }
            if op > from {
                push_err(E_JUNK, S.rec_line, rec, 0, 0);
            }
            S.i = ip as u32;
            S.o = op as u32;
            return JUNK_EOF;
        }
        if c == b'\\' {
            if ip > sent8_ptr {
                S.i = ip as u32;
                S.o = op as u32;
                return JUNK_MORE;
            }
            let q = read_u32(ip);
            let e = ((q >> 8) & 0xff) as u8;
            if e == b'n' {
                ip = ip.add(2);
                S.line += 1;
                if op > from {
                    push_err(E_JUNK, S.rec_line, rec, 0, 0);
                }
                S.i = ip as u32;
                S.o = op as u32;
                return JUNK_EOL;
            }
            if q == 0x6E5C_725C {
                ip = ip.add(4);
                S.line += 1;
                if op > from {
                    push_err(E_JUNK, S.rec_line, rec, 0, 0);
                }
                S.i = ip as u32;
                S.o = op as u32;
                return JUNK_EOL;
            }
            if e == b'r' {
                ip = handle_stray_cr(ip);
                if S.status != 0 {
                    return JUNK_EOF;
                }
                continue;
            }
            let adv = copy_escape(ip, op) as usize;
            if S.status != 0 {
                return JUNK_EOF;
            }
            ip = ip.add(adv);
            op = op.add(adv);
            continue;
        }
        *op = c;
        op = op.add(1);
        ip = ip.add(1);
    }
}

#[cold]
#[inline(never)]
unsafe fn end_record_slow(mut op: *mut u8, nf: i32, ip: *const u8) -> *mut u8 {
    let width = S.width;
    let rec = S.kept;
    if width < 0 {
        S.width = nf;
        write_u16(op, 0x5D22); // "]
        op = op.add(2);
    } else if nf < width {
        let pad_count = (width - nf) as u32;
        let out_base = S.out_base;
        let cur_o = (op as u32) - out_base;
        let rem_in = S.in_len.saturating_sub((ip as u32) - S.in_base);
        let need = cur_o + pad_count * 3 + rem_in * 3 + 2048;
        if need > S.out_cap {
            S.need_out = need;
            S.status = RET_GROW_OUT;
            return op;
        }
        *op = b'"';
        op = op.add(1);
        let mut n = pad_count;
        while n > 0 {
            write_u32(op, 0x0022_222C); // ,""
            op = op.add(3);
            n -= 1;
        }
        *op = b']';
        op = op.add(1);
        if !push_err(E_SHORT, S.rec_line, rec, nf as u32, 0) {
            return op;
        }
    } else {
        let rec_op = S.rec_op as *mut u8;
        let mut p = rec_op.add(if rec >= 2 { 3 } else { 2 });
        let mut rem = width;
        loop {
            loop {
                let c = *p;
                if c == b'"' {
                    break;
                }
                if c == b'\\' {
                    p = p.add(2);
                } else {
                    p = p.add(1);
                }
            }
            rem -= 1;
            if rem == 0 {
                break;
            }
            p = p.add(3);
        }
        let cut = p;
        let extra_start = p.add(3);
        let len = (op as usize) - (extra_start as usize);
        let nextras = S.nextras as usize;
        if nextras + len > S.extra_cap as usize {
            S.need_extra = (nextras + len) as u32;
            S.status = RET_GROW_EXTRA;
            return op;
        }
        core::ptr::copy_nonoverlapping(
            extra_start,
            (S.extra_base as *mut u8).add(nextras),
            len,
        );
        if !push_err(E_LONG, S.rec_line, rec, nextras as u32, len as u32) {
            return op;
        }
        S.nextras = (nextras + len) as u32;
        op = cut;
        write_u16(op, 0x5D22); // "]
        op = op.add(2);
    }
    if rec == 0 {
        S.rec0_end = ((op as u32) - S.out_base) as i32;
        op = op.add(9);
    }
    op
}

#[cold]
#[inline(never)]
unsafe fn rollback_ret() -> i32 {
    S.i = S.rec_ip - S.in_base;
    S.o = S.rec_op - S.out_base;
    S.nerr = S.rec_nerr;
    S.line = S.rec_line;
    if S.status != 0 {
        S.status
    } else {
        RET_NEED_MORE
    }
}

#[cold]
#[inline(never)]
unsafe fn put_bytes(mut op: *mut u8, s: &[u8]) -> *mut u8 {
    let mut k = 0;
    while k < s.len() {
        *op = *s.get_unchecked(k);
        op = op.add(1);
        k += 1;
    }
    op
}

#[cold]
#[inline(never)]
unsafe fn put_u32(mut op: *mut u8, mut v: u32) -> *mut u8 {
    if v == 0 {
        *op = b'0';
        return op.add(1);
    }
    let mut tmp = [0u8; 10];
    let mut k = 0usize;
    while v > 0 {
        tmp[k] = b'0' + (v % 10) as u8;
        v /= 10;
        k += 1;
    }
    while k > 0 {
        k -= 1;
        *op = tmp[k];
        op = op.add(1);
    }
    op
}

#[no_mangle]
pub unsafe extern "C" fn write_errors(header: u32) -> u32 {
    let out_base = S.out_base as *mut u8;
    let mut op = out_base.add(S.o as usize);
    op = put_bytes(op, b"],\"errors\":[");
    let nerr = S.nerr as usize;
    let err_base = S.err_base as *const u32;
    let extra_base = S.extra_base as *const u8;
    let hdr = header != 0;

    let mut n = 0usize;
    while n < nerr {
        if n > 0 {
            *op = b',';
            op = op.add(1);
        }
        let p = err_base.add(n * 5);
        let code = *p;
        let line = *p.add(1);
        let rec = *p.add(2);
        let a = *p.add(3);
        let b = *p.add(4);

        let prefix: &[u8] = match code {
            E_STRAY => b"{\"code\":\"stray_cr\",\"line\":",
            E_JUNK => b"{\"code\":\"quote_junk\",\"line\":",
            E_UNTERM => b"{\"code\":\"unterminated_quote\",\"line\":",
            E_SHORT => b"{\"code\":\"short_row\",\"line\":",
            _ => b"{\"code\":\"long_row\",\"line\":",
        };
        op = put_bytes(op, prefix);
        op = put_u32(op, line);
        op = put_bytes(op, b",\"row\":");
        if hdr {
            if rec == 0 {
                write_u32(op, 0x6C6C_756E);
                op = op.add(4);
            } else {
                op = put_u32(op, rec - 1);
            }
        } else {
            op = put_u32(op, rec);
        }
        if code == E_SHORT {
            op = put_bytes(op, b",\"fields\":");
            op = put_u32(op, a);
            *op = b'}';
            op = op.add(1);
        } else if code == E_LONG {
            op = put_bytes(op, b",\"extra\":[\"");
            let len = b as usize;
            core::ptr::copy_nonoverlapping(extra_base.add(a as usize), op, len);
            op = op.add(len);
            op = put_bytes(op, b"\"]}");
        } else {
            *op = b'}';
            op = op.add(1);
        }
        n += 1;
    }

    write_u16(op, 0x7D5D); // ]}
    op = op.add(2);
    let new_o = (op as u32) - (out_base as u32);
    S.o = new_o;
    new_o
}

#[no_mangle]
pub extern "C" fn heap_base() -> usize {
    let base = (&raw const __heap_base) as usize;
    (base + 63) & !63
}

#[no_mangle]
pub extern "C" fn state_ptr() -> usize {
    (&raw mut S) as usize
}

/// Register-lean streaming SIMD CSV reader: ONLY 5 hot GP locals (`ip`, `op`, `nf`, `line`, `sent8_ptr`)
/// + 3 XMM locals (`v_comma`, `v_bslash`, `v_quote`), so V8 Liftoff keeps ALL hot state in x86 registers!
#[no_mangle]
pub unsafe extern "C" fn read_window() -> i32 {
    let in_base = S.in_base as *const u8;
    let out_base = S.out_base as *mut u8;
    let sent_off = S.sentinel;
    S.sent_ptr = if sent_off == 0x7FFF_FFFF {
        u32::MAX
    } else {
        S.in_base + sent_off
    };
    let sent8_ptr = if sent_off == 0x7FFF_FFFF {
        usize::MAX as *const u8
    } else if sent_off < 8 {
        core::ptr::null()
    } else {
        in_base.add((sent_off - 8) as usize)
    };
    S.out_limit_ptr = if S.out_limit == 0x7FFF_FFFF {
        u32::MAX
    } else {
        S.out_base + S.out_limit
    };

    let mut ip = in_base.add(S.i as usize);
    let mut op = out_base.add(S.o as usize);
    let mut line = S.line;
    let mut kept = S.kept;
    let mut width = S.width;
    S.status = 0;

    let v_comma = core::ptr::read_volatile(SIMD_CONSTS.comma.as_ptr() as *const v128);
    let v_bslash = core::ptr::read_volatile(SIMD_CONSTS.bslash.as_ptr() as *const v128);
    let v_quote = core::ptr::read_volatile(SIMD_CONSTS.quote.as_ptr() as *const v128);

    'record: loop {
        if (op as u32) > S.out_limit_ptr {
            S.i = (ip as u32) - S.in_base;
            S.o = (op as u32) - S.out_base;
            S.line = line;
            S.kept = kept;
            return RET_FLUSH;
        }

        S.rec_ip = ip as u32;
        S.rec_op = op as u32;
        S.rec_nerr = S.nerr;
        S.rec_line = line;

        let mut q = read_u32(ip);
        if (q & 0xFFFF) == 0x6E5C || q == 0x6E5C_725C {
            loop {
                if ip > sent8_ptr {
                    { S.kept = kept; return rollback_ret(); }
                }
                if (q & 0xFFFF) == 0x6E5C {
                    ip = ip.add(2);
                } else if q == 0x6E5C_725C {
                    ip = ip.add(4);
                } else {
                    break;
                }
                line += 1;
                q = read_u32(ip);
            }
        }

        if (q & 0xFF) == 0x22 {
            if (ip as u32) < S.sent_ptr {
                break 'record;
            }
            { S.kept = kept; return rollback_ret(); }
        }

        S.rec_ip = ip as u32;
        S.rec_line = line;

        if kept >= 2 {
            write_u32(op, 0x0022_5B2C); // ,["
            op = op.add(3);
        } else {
            write_u16(op, 0x225B); // ["
            op = op.add(2);
        }

        let mut nf: i32 = 0;
        S.field_start = op as u32;
        let first_quoted = (q & 0xFFFF) == 0x225C;
        S.first_quoted = first_quoted as u32;
        let mut go_quoted = first_quoted;
        if first_quoted {
            if ip > sent8_ptr {
                { S.kept = kept; return rollback_ret(); }
            }
            ip = ip.add(2);
            S.open_ip = ip as u32;
            S.open_line = line;
        }

        let ended: u32;

        'field: loop {
            if !go_quoted {
                'unq: loop {
                    let v = v128_load(ip as *const v128);
                    v128_store(op as *mut v128, v);
                    let m_comma = u8x16_bitmask(u8x16_eq(v, v_comma)) as u32;
                    let m_spec =
                        u8x16_bitmask(v128_or(u8x16_eq(v, v_bslash), u8x16_eq(v, v_quote))) as u32;

                    if m_spec == 0 {
                        if m_comma == 0 {
                            ip = ip.add(16);
                            op = op.add(16);
                            continue 'unq;
                        }
                        let base_ip = ip;
                        nf += m_comma.count_ones() as i32;
                        let bit0 = m_comma.trailing_zeros() as usize;
                        op = op.add(bit0);
                        write_u32(op, 0x0022_2C22); // ","
                        op = op.add(3);
                        let mut pos = bit0 + 1;
                        let mut mc = m_comma & (m_comma - 1);

                        while mc != 0 {
                            let next_bit = mc.trailing_zeros() as usize;
                            v128_store(op as *mut v128, v128_load(base_ip.add(pos) as *const v128));
                            op = op.add(next_bit - pos);
                            write_u32(op, 0x0022_2C22); // ","
                            op = op.add(3);
                            pos = next_bit + 1;
                            mc &= mc - 1;
                        }

                        if pos < 16 {
                            v128_store(op as *mut v128, v128_load(base_ip.add(pos) as *const v128));
                            op = op.add(16 - pos);
                            ip = base_ip.add(16);
                            continue 'unq;
                        }
                        ip = base_ip.add(16);
                        S.field_start = op as u32;
                        if read_u16(ip) == 0x225C {
                            if ip > sent8_ptr {
                                { S.kept = kept; return rollback_ret(); }
                            }
                            ip = ip.add(2);
                            S.open_ip = ip as u32;
                            S.open_line = line;
                            break 'unq;
                        }
                        continue 'unq;
                    }

                    // m_spec != 0
                    let spec_bit = m_spec.trailing_zeros() as usize;
                    let mut mc = m_comma & ((m_spec & m_spec.wrapping_neg()) - 1);
                    let base_ip = ip;

                    if mc != 0 {
                        nf += mc.count_ones() as i32;
                        let bit0 = mc.trailing_zeros() as usize;
                        op = op.add(bit0);
                        write_u32(op, 0x0022_2C22); // ","
                        op = op.add(3);
                        let mut pos = bit0 + 1;
                        mc &= mc - 1;

                        while mc != 0 {
                            let next_bit = mc.trailing_zeros() as usize;
                            v128_store(op as *mut v128, v128_load(base_ip.add(pos) as *const v128));
                            op = op.add(next_bit - pos);
                            write_u32(op, 0x0022_2C22); // ","
                            op = op.add(3);
                            pos = next_bit + 1;
                            mc &= mc - 1;
                        }

                        let seg = spec_bit - pos;
                        if seg > 0 {
                            v128_store(op as *mut v128, v128_load(base_ip.add(pos) as *const v128));
                            op = op.add(seg);
                        } else {
                            ip = base_ip.add(spec_bit);
                            S.field_start = op as u32;
                            if read_u16(ip) == 0x225C {
                                if ip > sent8_ptr {
                                    { S.kept = kept; return rollback_ret(); }
                                }
                                ip = ip.add(2);
                                S.open_ip = ip as u32;
                                S.open_line = line;
                                break 'unq;
                            }
                        }
                        ip = base_ip.add(spec_bit);
                    } else {
                        ip = base_ip.add(spec_bit);
                        op = op.add(spec_bit);
                    }

                    if *ip == b'\\' {
                        if ip > sent8_ptr {
                            { S.kept = kept; return rollback_ret(); }
                        }
                        let q = read_u32(ip);
                        if (q & 0xFFFF) == 0x6E5C {
                            ip = ip.add(2);
                            line += 1;
                            ended = ENDED_EOL;
                            break 'field;
                        }
                        if q == 0x6E5C_725C {
                            ip = ip.add(4);
                            line += 1;
                            ended = ENDED_EOL;
                            break 'field;
                        }
                        if (q & 0xFFFF) == 0x225C {
                            write_u16(op, 0x225C);
                            ip = ip.add(2);
                            op = op.add(2);
                            continue 'unq;
                        }
                        if (q & 0xFFFF) == 0x725C {
                            { S.kept = kept; ip = handle_stray_cr(ip); }
                            if S.status != 0 {
                                { S.kept = kept; return rollback_ret(); }
                            }
                            continue 'unq;
                        }
                        let adv = copy_escape(ip, op) as usize;
                        if S.status != 0 {
                            { S.kept = kept; return rollback_ret(); }
                        }
                        ip = ip.add(adv);
                        op = op.add(adv);
                        continue 'unq;
                    }
                    if (ip as u32) >= S.sent_ptr {
                        { S.kept = kept; return rollback_ret(); }
                    }
                    ended = ENDED_EOF;
                    break 'field;
                }
            }

            // ---- QUOTED SIMD LOOP ----
            'quo: loop {
                let mask = loop {
                    let v = v128_load(ip as *const v128);
                    v128_store(op as *mut v128, v);
                    let m = v128_or(u8x16_eq(v, v_bslash), u8x16_eq(v, v_quote));
                    let mask = u8x16_bitmask(m) as u32;
                    if mask != 0 {
                        break mask;
                    }
                    ip = ip.add(16);
                    op = op.add(16);
                };
                let n = mask.trailing_zeros() as usize;
                ip = ip.add(n);
                op = op.add(n);

                if *ip == b'\\' {
                    if ip > sent8_ptr {
                        { S.kept = kept; return rollback_ret(); }
                    }
                    let q = read_u32(ip);
                    if (q & 0x00FF_FFFF) == 0x002C_225C {
                        ip = ip.add(3);
                        nf += 1;
                        write_u32(op, 0x0022_2C22); // ","
                        op = op.add(3);
                        S.field_start = op as u32;
                        if read_u16(ip) == 0x225C {
                            if ip > sent8_ptr {
                                { S.kept = kept; return rollback_ret(); }
                            }
                            ip = ip.add(2);
                            S.open_ip = ip as u32;
                            S.open_line = line;
                            continue 'quo;
                        }
                        go_quoted = false;
                        break 'quo;
                    }
                    if q == 0x225C_225C {
                        write_u16(op, 0x225C);
                        op = op.add(2);
                        ip = ip.add(4);
                        continue 'quo;
                    }
                    if (q & 0xFFFF) == 0x225C {
                        ip = ip.add(2);
                        let q2 = read_u32(ip);
                        if (q2 & 0xFFFF) == 0x6E5C {
                            ip = ip.add(2);
                            line += 1;
                            ended = ENDED_EOL;
                            break 'field;
                        }
                        if q2 == 0x6E5C_725C {
                            ip = ip.add(4);
                            line += 1;
                            ended = ENDED_EOL;
                            break 'field;
                        }
                        if (q2 & 0xFF) == 0x22 {
                            if (ip as u32) >= S.sent_ptr {
                                { S.kept = kept; return rollback_ret(); }
                            }
                            ended = ENDED_EOF;
                            break 'field;
                        }
                        S.line = line;
                        S.kept = kept; let jend = handle_junk(ip, op, sent8_ptr);
                        if S.status != 0 {
                            { S.kept = kept; return rollback_ret(); }
                        }
                        ip = S.i as *const u8;
                        op = S.o as *mut u8;
                        line = S.line;
                        if jend == JUNK_COMMA {
                            ip = ip.add(1);
                            nf += 1;
                            write_u32(op, 0x0022_2C22); // ","
                            op = op.add(3);
                            S.field_start = op as u32;
                            if read_u16(ip) == 0x225C {
                                if ip > sent8_ptr {
                                    { S.kept = kept; return rollback_ret(); }
                                }
                                ip = ip.add(2);
                                S.open_ip = ip as u32;
                                S.open_line = line;
                                continue 'quo;
                            }
                            go_quoted = false;
                            break 'quo;
                        } else if jend == JUNK_EOL {
                            ended = ENDED_EOL;
                            break 'field;
                        } else if jend == JUNK_MORE {
                            { S.kept = kept; return rollback_ret(); }
                        } else {
                            ended = ENDED_EOF;
                            break 'field;
                        }
                    }
                    if (q & 0xFFFF) == 0x6E5C {
                        write_u16(op, 0x6E5C);
                        op = op.add(2);
                        ip = ip.add(2);
                        line += 1;
                        continue 'quo;
                    }
                    if (q & 0xFFFF) == 0x725C {
                        write_u16(op, 0x6E5C);
                        op = op.add(2);
                        line += 1;
                        if (q >> 16) == 0x6E5C {
                            ip = ip.add(4);
                        } else {
                            ip = ip.add(2);
                            if (q >> 16) == 0x755C && hex4(ip) == 0x0a {
                                S.status = RET_UNREADABLE;
                                { S.kept = kept; return rollback_ret(); }
                            }
                        }
                        continue 'quo;
                    }
                    let adv = copy_escape(ip, op) as usize;
                    if S.status != 0 {
                        { S.kept = kept; return rollback_ret(); }
                    }
                    ip = ip.add(adv);
                    op = op.add(adv);
                    continue 'quo;
                }

                if (ip as u32) >= S.sent_ptr {
                    { S.kept = kept; return rollback_ret(); }
                }
                if !push_err(E_UNTERM, S.rec_line, kept, 0, 0) {
                    { S.kept = kept; return rollback_ret(); }
                }
                let fs = S.field_start as *mut u8;
                write_u16(fs, 0x225C);
                op = fs.add(2);
                ip = S.open_ip as *const u8;
                line = S.open_line;
                go_quoted = false;
                break 'quo;
            }
        }

        nf += 1;
        if nf == 1 && (op as u32) == S.field_start && S.first_quoted == 0 {
            op = S.rec_op as *mut u8;
        } else {
            if nf == width {
                write_u16(op, 0x5D22); // "]
                op = op.add(2);
            } else {
                S.kept = kept;
                op = end_record_slow(op, nf, ip);
                if S.status != 0 {
                    return rollback_ret();
                }
                width = S.width;
            }
            kept += 1;
        }

        if ended == ENDED_EOF {
            break 'record;
        }
    }

    S.i = (ip as u32) - S.in_base;
    S.o = (op as u32) - S.out_base;
    S.line = line;
    S.kept = kept;
    RET_DONE
}
