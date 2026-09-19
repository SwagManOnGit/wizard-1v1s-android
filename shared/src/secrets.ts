// Sealing the apocrypha.
//
// What this does: stops the fifteen unlisted spells being readable in the shipped JavaScript. Until
// this existed, a search for "Black Sun" in the bundle returned the name, the description, and the
// line `glyph: "sunburst", reverse: true` — which is the entire secret, since the glyph templates
// themselves have to ship anyway (every apocryphal spell is a reversal of a sign a listed spell
// already uses). The shapes were never the secret. The mapping was.
//
// What this does NOT do: keep the secret from anybody determined. The key is in the bundle, because
// the game has to recognise these spells offline, and anyone who opens a debugger can read the
// decoded table out of memory. This raises the cost from "Ctrl+F" to "understand the build and
// write a script", which is the difference between the secrets lasting an afternoon and lasting a
// while. The only real protection is content that is not in the build at all: hold two or three
// spells back for a later update, as docs/ENGAGEMENT-PLAN.md recommends.
import { SEALED } from './secrets.data';
import type { SpellDef } from './spells';

const KEY = 'a-wizard-never-tells';

/** Symmetric: the same function seals and unseals. */
export function transcode(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ (KEY.charCodeAt(i % KEY.length) + ((i * 37) & 0xff)) & 0xff;
  return out;
}

// Base64 by hand rather than btoa or Buffer: this package must build for the browser, the Android
// WebView and node without knowing which it is in.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
    out += b === undefined ? '=' : B64[(n >>> 6) & 63];
    out += c === undefined ? '=' : B64[n & 63];
  }
  return out;
}

function fromBase64(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12)
      | ((clean[i + 2] ? B64.indexOf(clean[i + 2]) : 0) << 6) | (clean[i + 3] ? B64.indexOf(clean[i + 3]) : 0);
    out[p++] = (n >>> 16) & 255;
    if (clean[i + 2]) out[p++] = (n >>> 8) & 255;
    if (clean[i + 3]) out[p++] = n & 255;
  }
  return out.subarray(0, p);
}

export function seal(spells: SpellDef[]): string {
  const json = JSON.stringify(spells);
  const bytes = new Uint8Array(json.length);
  for (let i = 0; i < json.length; i++) bytes[i] = json.charCodeAt(i) & 0xff;
  return toBase64(transcode(bytes));
}

export function unseal(blob: string = SEALED): SpellDef[] {
  const bytes = transcode(fromBase64(blob));
  let json = '';
  for (const b of bytes) json += String.fromCharCode(b);
  return JSON.parse(json) as SpellDef[];
}
