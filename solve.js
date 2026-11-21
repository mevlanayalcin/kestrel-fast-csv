// kestrel-fast-csv: dependency-free ES module drop-in for csv-reader 1.0.0.
// Backed by our no_std Rust WebAssembly simd128 (v128) 32-byte CSV transducer (w.wasm).

import { readFileSync } from "node:fs";

var NO_END = 0x7fffffff, PAD = 96, UNREADABLE = new Error();
var WIN_IN = 262144, WIN_OUT = 262144;
var ex = null, mem = null, S_PTR = 0, H_BASE = 0;
var inCap = 0, errCap = 0, extraCap = 0, outCap = 0, inPtr = 0, errPtr = 0, extraPtr = 0, outPtr = 0, u8 = null, S = null;
var patchBuf = new Uint8Array(32);

function init(wIn, wOut) {
  if (ex === null) {
    var wasm = readFileSync(new URL("./w.wasm", import.meta.url));
    ex = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports;
    mem = ex.memory; S_PTR = ex.state_ptr(); H_BASE = ex.heap_base();
    inCap = wIn; errCap = 4096; extraCap = 65536; outCap = wOut + 3 * wIn + 4096;
    layout(false);
  }
}

function layout(preserve) {
  var oldO = preserve ? S[11] : 0, oldNerr = preserve ? S[15] : 0, oldNextras = preserve ? S[16] : 0;
  var oldOut = outPtr, oldExt = extraPtr, oldErr = errPtr;
  var nIn = H_BASE;
  var nErr = (nIn + inCap + PAD + 63) & ~63;
  var nExt = (nErr + errCap * 20 + 63) & ~63;
  var nOut = (nExt + extraCap + 63) & ~63;
  var needP = ((nOut + outCap + 64) + 65535) >>> 16;
  var curP = mem.buffer.byteLength >>> 16;
  if (needP > curP) mem.grow(needP - curP);
  var b = new Uint8Array(mem.buffer);
  if (preserve) {
    if (nOut !== oldOut && oldO > 0) b.copyWithin(nOut, oldOut, oldOut + oldO);
    if (nExt !== oldExt && oldNextras > 0) b.copyWithin(nExt, oldExt, oldExt + oldNextras);
    if (nErr !== oldErr && oldNerr > 0) b.copyWithin(nErr, oldErr, oldErr + oldNerr * 20);
  }
  inPtr = nIn; errPtr = nErr; extraPtr = nExt; outPtr = nOut;
  u8 = b; S = new Int32Array(mem.buffer, S_PTR, 24);
  S[0] = inPtr; S[3] = outPtr; S[4] = outCap; S[6] = errPtr; S[7] = errCap; S[8] = extraPtr; S[9] = extraCap;
}

function hexVal(c) {
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 102) return c - 87;
  if (c >= 65 && c <= 70) return c - 55;
  return -1;
}

function hex4(idx) {
  var a = hexVal(u8[idx + 2]), b = hexVal(u8[idx + 3]), c = hexVal(u8[idx + 4]), d = hexVal(u8[idx + 5]);
  if ((a | b | c | d) < 0) throw UNREADABLE;
  return (a << 12) | (b << 8) | (c << 4) | d;
}

function writeAscii(ptr, s) { for (var j = 0; j < s.length; j++) u8[ptr + j] = s.charCodeAt(j); }

export function run(input) {
  init(WIN_IN, WIN_OUT);
  var t = String(input.text), header = input.header === true, lit = JSON.stringify(t), n = Buffer.byteLength(lit, "utf8");
  if (n + PAD > inCap || 3 * n + 4096 > outCap) {
    while (inCap < n + PAD) inCap *= 2;
    while (outCap < 3 * n + 4096) outCap *= 2;
    layout(false);
  }
  Buffer.from(mem.buffer, inPtr, n).write(lit, 0, n, "utf8");
  u8.fill(0x22, inPtr + n, inPtr + n + PAD);
  var i = 1;
  if (u8[inPtr + 1] === 0xef && u8[inPtr + 2] === 0xbb && u8[inPtr + 3] === 0xbf) i = 4;
  S[1] = NO_END; S[2] = n; S[5] = NO_END; S[10] = i; S[11] = 24; S[12] = 1; S[13] = 0; S[14] = -1; S[15] = 0; S[16] = 0; S[17] = -1;
  var rec0End = 24;
  for (;;) {
    var rc = ex.read_window();
    if (S[17] >= 0) { rec0End = S[17]; S[17] = -1; }
    if (rc === 0) break;
    if (rc === 3) { while (outCap < S[18]) outCap *= 2; layout(true); continue; }
    if (rc === 4) { errCap *= 2; layout(true); continue; }
    if (rc === 5) { while (extraCap < S[19]) extraCap *= 2; layout(true); continue; }
    throw UNREADABLE;
  }
  var kept = S[13];
  if (kept === 0) writeAscii(outPtr, header ? '  {"columns":[],"rows":[' : '{"columns":null,"rows":[');
  else {
    writeAscii(outPtr, header ? '             {"columns":' : '{"columns":null,"rows":[');
    writeAscii(outPtr + rec0End, header ? ',"rows":[' : kept >= 2 ? ',        ' : '         ');
  }
  var needErr = S[11] + S[15] * 96 + S[16] + 128;
  if (needErr > outCap) { while (outCap < needErr) outCap *= 2; layout(true); }
  var outLen = ex.write_errors(header ? 1 : 0);
  return JSON.parse(Buffer.from(mem.buffer, outPtr, outLen).toString("utf8"));
}

export function answerCases(read, write, winIn = WIN_IN, winOut = WIN_OUT) {
  init(winIn, winOut);
  if (winIn > inCap || winOut + 3 * winIn + 4096 > outCap) {
    if (winIn > inCap) inCap = winIn;
    var needO = winOut + 3 * inCap + 4096;
    if (needO > outCap) outCap = needO;
    layout(false);
  }
  var cap = winIn, wlen = 0, srcBase = 0, eof = false, o = 0, outBase = 0, p = 0, caseBaseAbs = 0, rec0EndAbs = 0;
  function setWin(n, ended) { wlen = n; eof = ended; u8.fill(0x22, inPtr + n, inPtr + n + PAD); S[1] = ended ? NO_END : n; S[2] = n; }
  function refill(from) {
    var keep = wlen - from;
    if (from === 0 && keep >= cap) {
      cap *= 2; if (cap > inCap) inCap = cap;
      var needO = o + 3 * (cap + PAD) + 4096; if (needO > outCap) outCap = needO;
      S[11] = o; layout(true);
    } else if (from > 0 && keep > 0) u8.copyWithin(inPtr, inPtr + from, inPtr + wlen);
    srcBase += from; var n = keep, ended = eof;
    while (!ended && n < cap) { var r = read(u8, inPtr + n, cap - n, srcBase + n); if (r <= 0) ended = true; else n += r; }
    setWin(n, ended); return from;
  }
  function ensureOut(need) { if (o + need <= outCap) return; while (outCap < o + need) outCap *= 2; S[11] = o; layout(true); }
  function flush() { if (o > 0) { write(u8, outPtr, o, outBase); outBase += o; o = 0; } }
  function patch(abs, str) {
    var len = str.length;
    for (var j = 0; j < len; j++) { var at = abs + j; if (at >= outBase) u8[outPtr + (at - outBase)] = str.charCodeAt(j); }
    if (abs < outBase) { var n = Math.min(len, outBase - abs); for (var j = 0; j < n; j++) patchBuf[j] = str.charCodeAt(j); write(patchBuf, 0, n, abs); }
  }
  function ensureIn(n) { while (p + n > wlen && !eof) p -= refill(p); }
  function ws() { for (;;) { ensureIn(64); var c = u8[inPtr + p]; if (c === 32 || c === 10 || c === 13 || c === 9) p++; else return; } }
  function expect(c) { ws(); if (u8[inPtr + p] !== c || p >= wlen) throw UNREADABLE; p++; }
  function key() {
    expect(34); ensureIn(256); var k = "";
    for (;;) { var c = u8[inPtr + p]; if (c === 34) break; if (c === 92 || c < 32 || k.length > 200) throw UNREADABLE; k += String.fromCharCode(c); p++; }
    if (p >= wlen) throw UNREADABLE; p++; expect(58); return k;
  }
  function skipVal() {
    ws(); var c = u8[inPtr + p];
    if (c === 34) {
      p++; for (;;) { ensureIn(8); var d = u8[inPtr + p]; if (d === 34) break; if (d < 32) throw UNREADABLE; p += d === 92 ? 2 : 1; }
      if (p >= wlen) throw UNREADABLE; p++;
    } else if (c === 123 || c === 91) {
      var cl = c + 2; p++; ws(); if (u8[inPtr + p] === cl) { p++; return; }
      for (;;) { if (c === 123) key(); skipVal(); ws(); if (u8[inPtr + p] === 44) p++; else if (u8[inPtr + p] === cl) { p++; return; } else throw UNREADABLE; }
    } else {
      var at = p;
      for (;;) { ensureIn(8); var d = u8[inPtr + p]; if ((d >= 48 && d <= 57) || (d >= 97 && d <= 122) || d === 45 || d === 43 || d === 46 || d === 69) p++; else break; }
      if (p === at || p > wlen) throw UNREADABLE;
    }
  }
  function readText() {
    ensureIn(64); ensureOut(3 * wlen + 2048);
    caseBaseAbs = outBase + o; o += 24; rec0EndAbs = outBase + o;
    var i = p;
    if (u8[inPtr + i] === 0xef && u8[inPtr + i + 1] === 0xbb && u8[inPtr + i + 2] === 0xbf) i += 3;
    else if (u8[inPtr + i] === 0x5c && u8[inPtr + i + 1] === 0x75 && hex4(inPtr + i) === 0xfeff) i += 6;
    S[5] = winOut; S[10] = i; S[11] = o; S[12] = 1; S[13] = 0; S[14] = -1; S[15] = 0; S[16] = 0; S[17] = -1;
    for (;;) {
      var rc = ex.read_window();
      if (S[17] >= 0) { rec0EndAbs = outBase + S[17]; S[17] = -1; }
      if (rc === 0) { p = S[10] + 1; o = S[11]; return; }
      if (rc === 2) { o = S[11]; flush(); S[11] = 0; continue; }
      if (rc === 1) { if (eof) throw UNREADABLE; o = S[11]; S[10] -= refill(S[10]); ensureOut(3 * wlen + 2048); S[11] = o; continue; }
      if (rc === 3) { o = S[11]; while (outCap < S[18]) outCap *= 2; layout(true); continue; }
      if (rc === 4) { o = S[11]; errCap *= 2; layout(true); continue; }
      if (rc === 5) { o = S[11]; while (extraCap < S[19]) extraCap *= 2; layout(true); continue; }
      throw UNREADABLE;
    }
  }
  function writeAnswer(header) {
    var kept = S[13];
    if (kept === 0) patch(caseBaseAbs, header ? '  {"columns":[],"rows":[' : '{"columns":null,"rows":[');
    else {
      patch(caseBaseAbs, header ? '             {"columns":' : '{"columns":null,"rows":[');
      patch(rec0EndAbs, header ? ',"rows":[' : kept >= 2 ? ',        ' : '         ');
    }
    ensureOut(S[15] * 96 + S[16] + 128); S[11] = o; o = ex.write_errors(header ? 1 : 0);
  }
  function readInputObj() {
    expect(123); var header = false, haveText = false, haveHeader = false; ws();
    if (u8[inPtr + p] !== 125) {
      for (;;) {
        var k = key(); ws();
        if (k === "text") { if (haveText || u8[inPtr + p] !== 34) throw UNREADABLE; haveText = true; p++; readText(); }
        else if (k === "header") {
          if (haveHeader) throw UNREADABLE; haveHeader = true; ensureIn(8);
          if (u8[inPtr + p] === 0x74 && u8[inPtr + p + 1] === 0x72 && u8[inPtr + p + 2] === 0x75 && u8[inPtr + p + 3] === 0x65) {
            var nx = u8[inPtr + p + 4];
            if (nx === 44 || nx === 125 || nx === 32 || nx === 10 || nx === 13 || nx === 9) { header = true; p += 4; } else throw UNREADABLE;
          } else skipVal();
        } else skipVal();
        ws(); if (u8[inPtr + p] === 44) p++; else break;
      }
    }
    expect(125); if (!haveText) throw UNREADABLE; writeAnswer(header);
  }
  try {
    refill(0); expect(91); ensureOut(1); u8[outPtr + o++] = 91; ws();
    if (u8[inPtr + p] === 93) p++;
    else {
      for (var n = 0; ; n++) {
        if (n > 0) { ensureOut(1); u8[outPtr + o++] = 44; }
        expect(123); var haveInput = false;
        for (;;) {
          var k = key();
          if (k === "input") { if (haveInput) throw UNREADABLE; haveInput = true; readInputObj(); }
          else skipVal();
          ws(); if (u8[inPtr + p] === 44) p++; else break;
        }
        expect(125); if (!haveInput) throw UNREADABLE; ws();
        if (u8[inPtr + p] === 44) p++; else break;
      }
      expect(93);
    }
    ws(); if (p !== wlen || !eof) throw UNREADABLE;
    ensureOut(1); u8[outPtr + o++] = 93; flush(); return true;
  } catch { return false; }
}
