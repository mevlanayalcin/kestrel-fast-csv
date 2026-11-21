// kestrel-fast-csv: a faster drop-in for make.fun's csv-reader 1.0.0, read by the same broken-row policy.
//
// run(input) returns csv-reader's {columns, rows, errors} for any {text, header}. Underneath is one byte-level reader,
// readCore, that reads the text as a JSON string literal (UTF-8 bytes, JSON escapes as they stand) and writes the
// answer straight out as JSON bytes: a field's bytes are copied as they stand, since a JSON-escaped character is a
// valid JSON-escaped character in the answer too. run() hands it JSON.stringify(text) and parses what it writes.
// answerCases() hands it each case's text where it lies in a cases file, a window of the file at a time, and hands
// the answers on a window at a time, so no text or field of a case ever becomes a JavaScript string; main() is the
// driver main.ts runs.
//
// The policy (csv-reader 1.0.0): a U+FEFF at the very start is dropped; a record ends at LF or CRLF, and a line left
// with no characters is no record; outside quotes a CR not followed by LF is dropped (stray_cr); a quoted field runs
// to the next quote that is not doubled, "" in it one quote and CRLF or a lone CR in it LF; what follows its closing
// quote up to the next comma or line break is appended (quote_junk, when the field ends); a quote that never closes
// is literal and the text after it is read again unquoted (unterminated_quote); rows are padded (short_row) or cut
// (long_row) to the first record's width; each error carries the 1-based line its record starts on and its row.
//
// readCore copies eight bytes a step (DataView, little-endian) and finds the next comma, quote or backslash in them
// by the SWAR zero-byte test, picking the first of the two words that holds one without a branch. It holds only what
// most fields meet; the rest is in small functions it calls, which V8 runs unoptimised. What those return is truncated
// to int32 (| 0) where it flows back into readCore's positions, so V8 keeps them as untagged int32 in registers rather
// than as checked small integers. Module state is held in var bindings, which V8 reads without the hole checks a
// module's let and const bindings need.

var E_STRAY = 0;
var E_JUNK = 1;
var E_UNTERM = 2;
var E_SHORT = 3;
var E_LONG = 4;
var CODE_JSON = [
  '{"code":"stray_cr","line":',
  '{"code":"quote_junk","line":',
  '{"code":"unterminated_quote","line":',
  '{"code":"short_row","line":',
  '{"code":"long_row","line":',
];

var NO_END = 0x7fffffff;
/** The quotes after a window's bytes: the copy loops read up to 15 bytes past the quote they stop at. */
var PAD = 16;

/** Thrown for bytes this reader does not take: \u escapes JSON.stringify never writes (of a comma, a quote, a CR, an
 * LF or a leading U+FEFF), or a cases file laid out another way. The caller then reads the input the plain way. */
var UNREADABLE = new Error('bytes this reader does not take');

/** readCore's answer when the window ends inside a record: read more, then read again from `resume`. */
var NEED_MORE = -1;

/** readCore's answer when the output moved to a larger buffer at a record's end: read on from `resume`. */
var MOVED = -2;

// ---- The input window ----
// src holds bytes srcBase onward of the input, `wlen` of them, then PAD quotes: the reader takes a quote it meets at or
// past `sentinel` (wlen, or NO_END once the input has ended) for the window's end rather than the text's.
var src = new Uint8Array(PAD);
var srcView = new DataView(src.buffer);
var wlen = 0;
var srcBase = 0;
var eof = true;
var sentinel = NO_END;
var readFn = null;
/** How many bytes a refill puts in src at most: the window's length. */
var cap = 0;

// ---- The output window ----
// out holds the output from outBase on, `o` bytes of it; past outLimit it is handed to writeFn at a record's start.
var out = new Uint8Array(1 << 16);
var outView = new DataView(out.buffer);
var o = 0;
var outBase = 0;
var outLimit = NO_END;
var writeFn = null;

// ---- The case being read ----
var caseBaseAbs = 0; // where its answer starts in the output (24 bytes kept for its frame)
var rec0EndAbs = 0; // where its first record ends (9 bytes kept for ,"rows":[)
var cLine = 1;
var kept = 0;
var width = -1;
var resume = 0;
// The record being read (kept here, not in readCore's locals, which V8 would have to spill): where it starts in the
// input and the output, its error count, line and first line, a long row's cut, and its quoted field's start.
var rI = 0;
var rO = 0;
var rN = 0;
var rL = 0;
var rLineOf = 0;
var rCut = 0;
var rExtra = 0;
var rOpenI = 0;
var rOpenLine = 0;
// Its errors, five numbers each (code, line, record, a, b), and the cut fields of its long rows.
var errs = new Int32Array(5 << 12);
var nerr = 0;
var extras = new Uint8Array(1 << 16);
var nextras = 0;

function setWindow(bytes, n, ended) {
  if (bytes !== src) {
    src = bytes;
    srcView = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  }
  wlen = n;
  eof = ended;
  src.fill(0x22, n, n + PAD);
  sentinel = ended ? NO_END : n;
}

/** Keeps src[from..wlen) at the window's start and reads on; returns how far the bytes moved. */
function refill(from) {
  let buf = src;
  const keep = wlen - from;
  if (from === 0 && keep >= cap) {
    // A record longer than the window: a window twice as long.
    cap *= 2;
    if (cap + PAD > buf.length) {
      buf = new Uint8Array(cap + PAD);
      buf.set(src.subarray(0, keep));
    }
    room(3 * (cap + PAD));
  } else buf.copyWithin(0, from, wlen);
  srcBase += from;
  let n = keep;
  let ended = eof;
  while (!ended && n < cap) {
    const r = readFn(buf, n, cap - n, srcBase + n);
    if (r <= 0) ended = true;
    else n += r;
  }
  setWindow(buf, n, ended);
  return from;
}

/** Makes room in the output for `need` more bytes. */
function room(need) {
  if (o + need <= out.length) return;
  let n = out.length * 2;
  while (n < o + need) n *= 2;
  const b = new Uint8Array(n);
  b.set(out.subarray(0, o));
  out = b;
  outView = new DataView(b.buffer);
}

function flush() {
  if (o > 0) writeFn(out, 0, o, outBase);
  outBase += o;
  o = 0;
}

/** Writes the ASCII string s at output position abs: in the window, or in the file where it was already handed on. */
function patch(abs, s) {
  for (let j = 0; j < s.length; j++) {
    const at = abs + j;
    if (at >= outBase) out[at - outBase] = s.charCodeAt(j);
  }
  if (abs < outBase) {
    const n = Math.min(s.length, outBase - abs);
    const b = new Uint8Array(n);
    for (let j = 0; j < n; j++) b[j] = s.charCodeAt(j);
    writeFn(b, 0, n, abs);
  }
}

function pushErr(code, line, rec, a, b) {
  if (nerr * 5 + 5 > errs.length) {
    const e = new Int32Array(errs.length * 2);
    e.set(errs);
    errs = e;
  }
  const j = nerr * 5;
  errs[j] = code;
  errs[j + 1] = line;
  errs[j + 2] = rec;
  errs[j + 3] = a;
  errs[j + 4] = b;
  nerr++;
}

function hexVal(c) {
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 102) return c - 87;
  if (c >= 65 && c <= 70) return c - 55;
  return -1;
}

/** The code unit of the \uXXXX escape at i. */
function hex4(s, i) {
  const a = hexVal(s[i + 2]);
  const b = hexVal(s[i + 3]);
  const c = hexVal(s[i + 4]);
  const d = hexVal(s[i + 5]);
  if ((a | b | c | d) < 0) throw UNREADABLE;
  return (a << 12) | (b << 8) | (c << 4) | d;
}

/** Copies the \uXXXX escape at i to the output at oo, refusing one this reader does not take. */
function copyU(s, i, ob, oo) {
  const v = hex4(s, i);
  if (v === 0x0a || v === 0x0d || v === 0x22 || v === 0x2c) throw UNREADABLE;
  for (let j = 0; j < 6; j++) ob[oo + j] = s[i + j];
}

/**
 * Ends a record whose field count is not the width (or that is the first): sets the width from the first record and
 * keeps room after it for ,"rows":[, pads a short row with empty fields (short_row) or cuts a long one at `cut`, its
 * cut fields from `extraStart` on (long_row). Returns where the output goes on (`out` may have grown).
 */
function endRecord(oo, nf, cut, extraStart, line, rec) {
  if (width < 0) {
    width = nf;
    out[oo] = 0x22;
    out[oo + 1] = 0x5d;
    oo += 2;
  } else if (nf < width) {
    o = oo;
    room(3 * (width - nf) + 3 * src.length + 64);
    out[oo++] = 0x22;
    for (let n = nf; n < width; n++) {
      out[oo] = 0x2c;
      out[oo + 1] = 0x22;
      out[oo + 2] = 0x22;
      oo += 3;
    }
    out[oo++] = 0x5d;
    pushErr(E_SHORT, line, rec, nf, 0);
  } else {
    const len = oo - extraStart;
    if (nextras + len > extras.length) {
      let n = extras.length * 2;
      while (n < nextras + len) n *= 2;
      const x = new Uint8Array(n);
      x.set(extras.subarray(0, nextras));
      extras = x;
    }
    extras.set(out.subarray(extraStart, oo), nextras);
    pushErr(E_LONG, line, rec, nextras, len);
    nextras += len;
    oo = cut;
    out[oo] = 0x22;
    out[oo + 1] = 0x5d;
    oo += 2;
  }
  if (rec === 0) {
    rec0EndAbs = outBase + oo;
    oo += 9; // room for ,"rows":[
  }
  return oo;
}

/** Starts a case's answer at the output's end. */
function beginCase() {
  room(3 * src.length + 64);
  caseBaseAbs = outBase + o;
  o += 24; // room for {"columns":null,"rows":[
  rec0EndAbs = outBase + o;
  cLine = 1;
  kept = 0;
  width = -1;
  nerr = 0;
  nextras = 0;
}

/** Where a cold helper leaves the output position it wrote up to. */
var co = 0;

// ---- The reader ----
// readCore is made for one input window and one output buffer (src and out, and their views), which it holds as
// constants: a function V8 has only ever made one closure of is optimised for that closure's own variables, so the
// views' maps and the window's place are known to the compiled code rather than checked and loaded at every step.
// answerCases reads every cases file through the same two buffers, so the reader warmed and compiled in prepare() is
// the one main() runs. When either buffer is replaced (a window or an output that has to grow, or run()'s own), the
// next call makes another closure, which V8 then runs without that.

var core = null;
var coreSrc = null;
var coreOut = null;

/** The reader for src and out as they are now. */
function reader() {
  if (core === null || coreSrc !== src || coreOut !== out) {
    coreSrc = src;
    coreOut = out;
    core = makeReadCore(src, srcView, outView);
  }
  return core;
}

/** The reader of the window s (its view sv) that writes through dv, the output's view. */
function makeReadCore(s, sv, dv) {
  return readCore;

  /**
   * Reads the case's CSV text from src[start] on and writes its records. Returns the index of the closing quote of the
   * text's literal, or NEED_MORE when the window ends inside a record: the case's state is then as it was at that
   * record's start, src[resume], which the caller reads on from once the window holds more; or MOVED when the output
   * moved to a larger buffer, which this reader does not write: the caller reads on from src[resume] with another.
   *
   * Only what most fields meet is here (commas, line breaks, quoted fields with "" and line breaks in them); the rest
   * (a stray CR, junk after a closing quote, a quote that never closes, other escapes, a short or long row) is in small
   * functions of its own, so the optimised code of this one stays small.
   */
  function readCore(start) {
    // The SWAR constants, as locals (module variables would be loaded on every use).
    const ONES = 0x01010101;
    const HIGHS = -0x7f7f7f80; // 0x80808080
    const COMMAS = 0x2c2c2c2c;
    const QUOTES = 0x22222222;
    const SLASHES = 0x5c5c5c5c;
    const sent = sentinel;
    let oo = o | 0;
    let k = kept | 0;
    let wd = width | 0;
    let line = cLine | 0;
    let i = start | 0;

    for (;;) {
      // A record's start.
      if (oo > outLimit) {
        o = oo;
        flush();
        oo = o | 0;
      }
      rI = i;
      rO = oo;
      rN = nerr;
      rL = line;
      // Lines with no characters are no records.
      while (s[i] === 0x5c) {
        if (s[i + 1] === 0x6e) i += 2;
        else if (s[i + 1] === 0x72 && s[i + 2] === 0x5c && s[i + 3] === 0x6e) i += 4;
        else break;
        line++;
      }
      let ended = 0; // 1 a line break, 2 the end of the text, 3 the end of the window
      if (s[i] === 0x22) {
        if (i < sent) break; // the end of the text
        ended = 3;
      }
      rLineOf = line;
      if (k >= 2) dv.setInt8(oo++, 0x2c);
      dv.setInt16(oo, 0x225b, true); // ["
      oo += 2;
      let nf = 0;
      // The field being read: where its value starts, and the scan's comma mask (0 inside quotes, where a comma is
      // text). `quoted`: whether the record's first field opens with a quote.
      let fieldStart = oo;
      const quoted = s[i] === 0x5c && s[i + 1] === 0x22;
      let cm = HIGHS;
      if (quoted) {
        i += 2;
        rOpenI = i;
        rOpenLine = line;
        cm = 0;
      }
      while (ended === 0) {
        // Copy up to the next quote, backslash or (outside quotes) comma, eight bytes a step.
        let n = 0;
        for (;;) {
          const w = sv.getInt32(i, true);
          const x = sv.getInt32(i + 4, true);
          const a = w ^ COMMAS;
          const b = w ^ QUOTES;
          const d = w ^ SLASHES;
          const m = (((a - ONES) & cm) | (b - ONES) | (d - ONES)) & ~w & HIGHS;
          const a2 = x ^ COMMAS;
          const b2 = x ^ QUOTES;
          const d2 = x ^ SLASHES;
          const m2 = (((a2 - ONES) & cm) | (b2 - ONES) | (d2 - ONES)) & ~x & HIGHS;
          dv.setInt32(oo, w, true);
          dv.setInt32(oo + 4, x, true);
          if ((m | m2) !== 0) {
            // The first of them: in w when m is not 0, else in x (no branch, which the CPU would mispredict).
            const z = (m | -m) >> 31;
            n = (((31 - Math.clz32(m & -m)) >> 3) & z) | ((4 + ((31 - Math.clz32(m2 & -m2)) >> 3)) & ~z);
            break;
          }
          i = (i + 8) | 0;
          oo = (oo + 8) | 0;
        }
        i = (i + n) | 0;
        oo = (oo + n) | 0;
        let c = s[i];
        if (c === 0x5c && cm === 0) {
          // An escape inside quotes.
          if (i + 8 > sent) {
            // An escape at the window's end: read it once the window holds the bytes after it.
            ended = 3;
            break;
          }
          const e = s[i + 1];
          if (e === 0x22) {
            if (s[i + 2] === 0x5c && s[i + 3] === 0x22) {
              // "" inside quotes: one quote
              dv.setInt16(oo, 0x225c, true); // \"
              oo += 2;
              i += 4;
              continue;
            }
            // The closing quote: a comma, a line break or the text's end follows, or what follows it up to the next
            // comma or line break is appended (junk).
            i += 2;
            cm = HIGHS;
            c = s[i];
            const lineBreak =
              c === 0x5c && (s[i + 1] === 0x6e || (s[i + 1] === 0x72 && s[i + 2] === 0x5c && s[i + 3] === 0x6e));
            if (c !== 0x2c && c !== 0x22 && !lineBreak) {
              i = junk(i, oo, k) | 0;
              oo = co | 0;
              c = s[i];
            }
            if (c !== 0x2c) continue;
          } else {
            if (e === 0x6e) {
              i += 2;
            } else if (e === 0x72) {
              // CRLF or a lone CR inside quotes: one LF
              i += 2;
              if (s[i] === 0x5c) {
                if (s[i + 1] === 0x6e) i += 2;
                else if (s[i + 1] === 0x75) checkLf(s, i);
              }
            } else {
              i = copyEscape(i, oo) | 0;
              oo = co | 0;
              continue;
            }
            dv.setInt16(oo, 0x6e5c, true); // \n
            oo += 2;
            line++;
            continue;
          }
        }
        if (c === 0x2c) {
          // A comma outside quotes: the field ends and the next begins.
          i++;
          nf++;
          if (nf === wd) {
            rCut = oo;
            rExtra = oo + 3;
          }
          dv.setInt32(oo, 0x222c22, true); // ","
          oo += 3;
          fieldStart = oo;
          if (s[i] === 0x5c && s[i + 1] === 0x22) {
            i += 2;
            rOpenI = i;
            rOpenLine = line;
            cm = 0;
          }
        } else if (c === 0x22) {
          // The literal's closing quote: the end of the window, or of the text (or a quote that never closes).
          if (i >= sent) ended = 3;
          else if (cm !== 0) ended = 2;
          else {
            i = unterminated(fieldStart, k) | 0;
            oo = fieldStart + 2;
            line = rOpenLine | 0;
            cm = HIGHS;
          }
        } else if (i + 8 > sent) {
          ended = 3;
        } else {
          // An escape outside quotes.
          const e = s[i + 1];
          if (e === 0x6e) {
            i += 2;
            line++;
            ended = 1;
          } else if (e === 0x72 && s[i + 2] === 0x5c && s[i + 3] === 0x6e) {
            // CRLF
            i += 4;
            line++;
            ended = 1;
          } else {
            // A CR not followed by LF is dropped (stray_cr); any other escape stands as it is (\" too: a quote in an
            // unquoted field is text).
            if (e === 0x72) i = strayCr(i, k) | 0;
            else {
              i = copyEscape(i, oo) | 0;
              oo = co | 0;
            }
          }
        }
      }

      if (ended === 3) {
        // The window ends inside this record: read it again once there is more.
        nerr = rN;
        resume = rI;
        cLine = rL;
        o = rO;
        kept = k;
        return NEED_MORE;
      }
      // The record ends.
      nf++;
      if (nf === 1 && oo === fieldStart && !quoted) {
        // A line that held only stray CRs: no record (its stray_cr errors stay).
        oo = rO;
      } else {
        if (nf === wd) {
          dv.setInt16(oo, 0x5d22, true); // "]
          oo += 2;
        } else {
          oo = endRecord(oo, nf, rCut, rExtra, rLineOf, k) | 0;
          wd = width | 0;
        }
        k++;
      }
      if (ended === 2) break;
      if (outView !== dv) {
        // endRecord moved the output to a larger buffer.
        kept = k;
        cLine = line;
        o = oo;
        resume = i;
        return MOVED;
      }
    }
    kept = k;
    cLine = line;
    o = oo;
    return i;
  }
}

/** A CR not followed by LF, outside quotes, at i: dropped (stray_cr). Returns where reading goes on. */
function strayCr(i, rec) {
  pushErr(E_STRAY, rLineOf, rec, 0, 0);
  i += 2;
  if (src[i] === 0x5c && src[i + 1] === 0x75) checkLf(src, i);
  return i;
}

/** Copies the escape at i to the output at oo as it stands; returns where reading goes on (co: the output's). */
function copyEscape(i, oo) {
  if (src[i + 1] === 0x75) {
    copyU(src, i, out, oo);
    co = oo + 6;
    return i + 6;
  }
  out[oo] = 0x5c;
  out[oo + 1] = src[i + 1];
  co = oo + 2;
  return i + 2;
}

/**
 * What follows a closing quote at i, up to the next comma or line break (or the end of the text or the window), is
 * appended as it stands to the field, a CR not followed by LF dropped (stray_cr); when it is not empty, quote_junk.
 * Returns where reading goes on, at what ended it (co: where the output goes on).
 */
function junk(i, oo, rec) {
  const s = src;
  const from = oo;
  for (;;) {
    const c = s[i];
    if (c === 0x2c || c === 0x22) break;
    if (c === 0x5c) {
      if (i + 8 > sentinel) break;
      const e = s[i + 1];
      if (e === 0x6e) break;
      if (e === 0x72) {
        if (s[i + 2] === 0x5c && s[i + 3] === 0x6e) break;
        i = strayCr(i, rec);
        continue;
      }
      i = copyEscape(i, oo);
      oo = co;
      continue;
    }
    out[oo++] = c;
    i++;
  }
  if (oo > from) pushErr(E_JUNK, rLineOf, rec, 0, 0);
  co = oo;
  return i;
}

/** A quote that never closes, its field's value at `at`: a literal quote, and the text after it read again unquoted. */
function unterminated(at, rec) {
  out[at] = 0x5c;
  out[at + 1] = 0x22;
  pushErr(E_UNTERM, rLineOf, rec, 0, 0);
  return rOpenI;
}

/** Refuses a \u escape of an LF after a CR (JSON.stringify writes an LF as \n). */
function checkLf(s, i) {
  if (hex4(s, i) === 0x0a) throw UNREADABLE;
}

var encoder = new TextEncoder();

function putString(str) {
  room(str.length + 16);
  o += encoder.encodeInto(str, out.subarray(o)).written;
}

/** Completes the case's answer: {"columns":…,"rows":[…],"errors":[…]}. */
function writeAnswer(header) {
  if (kept === 0) {
    patch(caseBaseAbs, header ? '  {"columns":[],"rows":[' : '{"columns":null,"rows":[');
  } else {
    // The frame around the first record; what it does not fill is JSON whitespace.
    patch(caseBaseAbs, header ? '             {"columns":' : '{"columns":null,"rows":[');
    patch(rec0EndAbs, header ? ',"rows":[' : kept >= 2 ? ',        ' : '         ');
  }
  let str = '],"errors":[';
  for (let n = 0; n < nerr; n++) {
    const j = n * 5;
    const code = errs[j];
    const rec = errs[j + 2];
    if (n > 0) str += ',';
    str += CODE_JSON[code] + errs[j + 1] + ',"row":' + (header ? (rec === 0 ? 'null' : rec - 1) : rec);
    if (code === E_SHORT) {
      str += ',"fields":' + errs[j + 3] + '}';
    } else if (code === E_LONG) {
      putString(str + ',"extra":["');
      const len = errs[j + 4];
      room(len);
      out.set(extras.subarray(errs[j + 3], errs[j + 3] + len), o);
      o += len;
      str = '"]}';
    } else str += '}';
  }
  putString(str + ']}');
}

// ---- The cases file, walked as bytes ----

var p = 0; // the walk's place in src

/** Has src hold at least n bytes from p on, unless the input ends first. */
function ensure(n) {
  while (p + n > wlen && !eof) p -= refill(p);
}

function ws() {
  for (;;) {
    ensure(64);
    const c = src[p];
    if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) p++;
    else return;
  }
}

function expect(c) {
  ws();
  if (src[p] !== c || p >= wlen) throw UNREADABLE;
  p++;
}

/** An object key of plain characters (at most 200), with the colon after it. */
function key() {
  expect(0x22);
  ensure(256);
  let k = '';
  for (;;) {
    const c = src[p];
    if (c === 0x22) break;
    if (c === 0x5c || c < 0x20 || k.length > 200) throw UNREADABLE;
    k += String.fromCharCode(c);
    p++;
  }
  if (p >= wlen) throw UNREADABLE;
  p++;
  expect(0x3a);
  return k;
}

/** Skips one JSON value: an id, or anything else beside the text and the header. */
function skipValue() {
  ws();
  const c = src[p];
  if (c === 0x22) {
    p++;
    for (;;) {
      ensure(8);
      const d = src[p];
      if (d === 0x22) break;
      if (d < 0x20) throw UNREADABLE;
      p += d === 0x5c ? 2 : 1;
    }
    if (p >= wlen) throw UNREADABLE;
    p++;
  } else if (c === 0x7b || c === 0x5b) {
    const close = c + 2;
    p++;
    ws();
    if (src[p] === close) {
      p++;
      return;
    }
    for (;;) {
      if (c === 0x7b) key();
      skipValue();
      ws();
      if (src[p] === 0x2c) p++;
      else if (src[p] === close) {
        p++;
        return;
      } else throw UNREADABLE;
    }
  } else {
    const at = p;
    for (;;) {
      const d = src[p];
      if ((d >= 0x30 && d <= 0x39) || (d >= 0x61 && d <= 0x7a) || d === 0x2d || d === 0x2b || d === 0x2e || d === 0x45) p++;
      else break;
    }
    if (p === at || p >= wlen) throw UNREADABLE;
  }
}

/** The case's text: its literal's contents from p on, read to the literal's closing quote. */
function text() {
  ensure(256);
  beginCase();
  let i = p;
  if (src[i] === 0xef && src[i + 1] === 0xbb && src[i + 2] === 0xbf) i += 3;
  else if (src[i] === 0x5c && src[i + 1] === 0x75 && hex4(src, i) === 0xfeff) throw UNREADABLE;
  for (;;) {
    const r = reader()(i);
    if (r === MOVED) i = resume;
    else if (r !== NEED_MORE) {
      p = r + 1;
      return;
    } else {
      if (eof) throw UNREADABLE;
      i = resume - refill(resume);
    }
  }
}

/** The input object {text, header}: its text read and its answer written. */
function input() {
  expect(0x7b);
  let header = false;
  let haveText = false;
  let haveHeader = false;
  ws();
  if (src[p] !== 0x7d) {
    for (;;) {
      const k = key();
      ws();
      if (k === 'text') {
        if (haveText || src[p] !== 0x22) throw UNREADABLE;
        haveText = true;
        p++;
        text();
      } else if (k === 'header') {
        if (haveHeader) throw UNREADABLE;
        haveHeader = true;
        if (src[p] === 0x74 && src[p + 1] === 0x72 && src[p + 2] === 0x75 && src[p + 3] === 0x65) {
          header = true;
          p += 4;
        } else skipValue();
      } else skipValue();
      ws();
      if (src[p] === 0x2c) p++;
      else break;
    }
  }
  expect(0x7d);
  if (!haveText) throw UNREADABLE;
  writeAnswer(header);
}

function putByte(b) {
  room(1);
  out[o++] = b;
}

function walk() {
  expect(0x5b);
  putByte(0x5b);
  ws();
  if (src[p] === 0x5d) p++;
  else {
    for (let n = 0; ; n++) {
      if (n > 0) putByte(0x2c);
      expect(0x7b);
      let haveInput = false;
      for (;;) {
        const k = key();
        if (k === 'input') {
          if (haveInput) throw UNREADABLE;
          haveInput = true;
          input();
        } else skipValue();
        ws();
        if (src[p] === 0x2c) p++;
        else break;
      }
      expect(0x7d);
      if (!haveInput) throw UNREADABLE;
      ws();
      if (src[p] === 0x2c) p++;
      else break;
    }
    expect(0x5d);
  }
  ws();
  if (p !== wlen || !eof) throw UNREADABLE;
  putByte(0x5d);
  flush();
}

/** The window and the output buffer answerCases reads and writes through. */
var winBuf = new Uint8Array(0);
var outBuf = new Uint8Array(0);
var outBufView = new DataView(outBuf.buffer);

/**
 * Answers a whole cases file, a JSON array of {id, input}: writes the JSON array of the answers, one per case and in
 * the cases' order, as UTF-8 JSON bytes. read(buf, off, len, pos) reads the file's bytes from pos into buf at off and
 * returns how many it read (0 at its end); write(buf, off, len, pos) writes len bytes of buf from off at the answers
 * file's position pos. Each case's text is read where it lies in the file, a window at a time. Returns false for a
 * file it does not read (JSON laid out another way, an escape JSON.stringify never writes, or not JSON at all), and
 * the caller then answers that file with run().
 */
export function answerCases(read, write, window = 1 << 20, outWindow = 1 << 20) {
  // The same buffers for every file (at least as large as main()'s), so that every file is read by the same reader.
  const winBytes = Math.max(window, 1 << 20) + PAD;
  const outBytes = Math.max(outWindow + 4 * window, 5 << 20) + (1 << 12);
  if (winBuf.length < winBytes) winBuf = new Uint8Array(winBytes);
  if (outBuf.length < outBytes) {
    outBuf = new Uint8Array(outBytes);
    outBufView = new DataView(outBuf.buffer);
  }
  readFn = read;
  writeFn = write;
  srcBase = 0;
  eof = false;
  cap = window;
  setWindow(winBuf, 0, false);
  out = outBuf;
  outView = outBufView;
  o = 0;
  outBase = 0;
  outLimit = outWindow;
  p = 0;
  try {
    refill(0);
    walk();
    return true;
  } catch {
    return false;
  } finally {
    readFn = null;
    writeFn = null;
    setWindow(new Uint8Array(PAD), 0, true);
    out = new Uint8Array(1 << 16);
    outView = new DataView(out.buffer);
  }
}

// ---- run() and the warm-up ----

var decoder = new TextDecoder();

/** csv-reader 1.0.0's answer for one input {text, header}: {columns, rows, errors}. */
export function run(input) {
  const t = String(input.text);
  const header = input.header === true;
  // JSON.stringify writes a lone surrogate as an escape, so these bytes are exact UTF-8 of the literal.
  const lit = JSON.stringify(t);
  const bytes = new Uint8Array(lit.length * 3 + PAD);
  const n = encoder.encodeInto(lit, bytes).written;
  cap = n;
  setWindow(bytes, n, true);
  out = new Uint8Array(3 * n + 256);
  outView = new DataView(out.buffer);
  o = 0;
  outBase = 0;
  outLimit = NO_END;
  writeFn = null;
  beginCase();
  let i = 1;
  if (bytes[1] === 0xef && bytes[2] === 0xbb && bytes[3] === 0xbf) i = 4;
  while (reader()(i) === MOVED) i = resume;
  writeAnswer(header);
  const answer = JSON.parse(decoder.decode(out.subarray(0, o)));
  setWindow(new Uint8Array(PAD), 0, true);
  out = new Uint8Array(1 << 16);
  outView = new DataView(out.buffer);
  return answer;
}

// Small texts in the shapes the competition's generator draws (a BOM, LF and CRLF files, blank lines, quoted fields
// with "" and line breaks, a lone CR inside quotes, stray CRs, junk after a closing quote, short and long rows, a
// quote that never closes, no last line break), so V8 optimises the reader with feedback for every branch such a
// file takes and does not throw its code away the first time a case meets a rarer one. Branches no such file takes
// (escapes JSON.stringify writes only for control characters, a line of nothing but stray CRs) get no feedback, so
// V8 compiles them as exits to the interpreter and the reader compiles in less time; a case that takes one is still
// read right, only slower.
var WARM_TEXTS = [
  '\uFEFFa,b,c\n\nd,"e""f",g\n"h\ni\rj k","l,m n é",o\n"p"q x"y,s,t,u\n\nv,w\rx\n"y"\n"z","""a",b"c\n\n,\n' +
    '"東京",xy,\nq,r,"s"kg\n"",x,y\n"open,a,b\nc,d',
  'a,b\r\n"c",d\r\n\r\ne\r\n"f\r\ng\rh",i,j\r\nk\rl,m\r\nn,"o" cm\r\n"f"!',
  'abcdefgh,"ijklmnopq","rs",tu,"v\nw"\nx\nabcdefghijklmnopqrstuvwxyz0123456789,"abcdefghijklmnopqrstuvwxyz0123456789 abcdefghijklmnopqrstuvwxyz",x\n',
  '"a"\r\n"b","c\t\\"\r\nd\t\\,"e"',
];

/** Runs the reader over WARM_TEXTS as a cases file read through windows of a few bytes; what it writes is thrown away. */
function warmUp(windows) {
  const file = new TextEncoder().encode(JSON.stringify(WARM_TEXTS.map((t, n) => ({ id: `w-${n}`, input: { text: t, header: n % 2 === 0 } }))));
  const sink = new Uint8Array(1 << 16);
  const read = (buf, off, len, pos) => {
    const n = Math.max(0, Math.min(len, file.length - pos));
    buf.set(file.subarray(pos, pos + n), off);
    return n;
  };
  const write = (buf, off, len, pos) => {
    if (pos + len <= sink.length) sink.set(buf.subarray(off, off + len), pos);
  };
  for (const win of windows) answerCases(read, write, win, 32);
}

/**
 * Readies the reader for a run over a big file: V8 flags that make it compile quicker (set with setFlags, node:v8's
 * setFlagsFromString), feedback on every branch from WARM_TEXTS, then one compile of it before the first case, so it
 * runs optimised from a case's first byte and is never thrown away and compiled again mid-case. Answers do not
 * depend on it.
 */
export function prepare(setFlags) {
  // The reader is compiled once, as the run's first case begins, and its compile costs about a third as much CPU as
  // the reading itself. Without inlining, loop peeling, escape analysis, load and store elimination or jump threading,
  // V8 compiles it in about a fifth less time, and it runs about as fast: it allocates nothing, and calls only what is
  // rare.
  setFlags('--no-turbo-inlining');
  setFlags('--no-turbo-loop-peeling');
  setFlags('--no-turbo-escape');
  setFlags('--no-turbo-load-elimination');
  setFlags('--no-turbo-store-elimination');
  setFlags('--no-turbo-jt');
  // Nothing else is hot for long: V8 would compile the error writers and the like with TurboFan halfway through a
  // file, at more cost than it saves.
  setFlags('--invocation-count-for-turbofan=100000');
  setFlags('--invocation-count-for-osr=100000');
  warmUp([23]);
  try {
    // Compiled at its next call, the first case's, before it reads a byte.
    setFlags('--allow-natives-syntax');
    new Function('f', '%PrepareFunctionForOptimization(f); %OptimizeFunctionOnNextCall(f);')(core);
  } catch {
    // Without natives syntax V8 optimises the reader on its own, a little later.
  }
}

// ---- The driver ----

/**
 * node:v8's setFlagsFromString, taken from the v8 binding the module wraps: loading node:v8 itself loads its heap
 * snapshot and stream helpers too, which costs more CPU than the flags save. The binding is a deprecated way in
 * (DEP0111), so deprecation warnings are turned off first, as nothing else here would print one; node:v8 when it is
 * not there.
 */
function flagSetter() {
  try {
    process.noDeprecation = true;
    const set = process.binding('v8').setFlagsFromString;
    if (typeof set === 'function') return set;
  } catch {
    // No binding: node:v8 below.
  }
  return process.getBuiltinModule('node:v8').setFlagsFromString;
}

/**
 * What main.ts runs: reads every case from /input/cases.json, answers each one alone and writes /output/answers.json,
 * a JSON array of the answers, one per case and in the cases' order (MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand
 * in for /input and /output outside a container). The file is read a window at a time by answerCases; a file it does
 * not read is answered the plain way: JSON.parse, run() on each case's input, JSON.stringify. node:fs comes by
 * process.getBuiltinModule and the flag setter by flagSetter(), so this module imports nothing.
 */
export function main() {
  const fs = process.getBuiltinModule('node:fs');
  const setFlags = flagSetter();
  // V8's incremental marking off, as the house baseline's driver runs (the rules let an entry tune V8's flags).
  setFlags('--no-incremental-marking');
  prepare(setFlags);
  const input = (process.env.MAKEFUN_INPUT_DIR ?? '/input') + '/cases.json';
  const output = (process.env.MAKEFUN_OUTPUT_DIR ?? '/output') + '/answers.json';
  const inFd = fs.openSync(input, 'r');
  const outFd = fs.openSync(output, 'w');
  const read = (buf, at, len, pos) => fs.readSync(inFd, buf, at, len, pos);
  const write = (buf, at, len, pos) => {
    for (let n = 0; n < len; ) n += fs.writeSync(outFd, buf, at + n, len - n, pos + n);
  };
  const done = answerCases(read, write);
  fs.closeSync(inFd);
  fs.closeSync(outFd);
  if (!done) {
    const cases = JSON.parse(fs.readFileSync(input, 'utf8'));
    const answers = [];
    for (const c of cases) answers.push(run(c.input));
    fs.writeFileSync(output, JSON.stringify(answers));
  }
}
