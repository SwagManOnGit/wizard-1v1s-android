// Paints the launcher icon, splash and Play feature graphic as pixel art and writes PNGs with no dependencies.
// Usage: node scripts/make-icon.mjs   (then: npx capacitor-assets generate --android)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// 32x32 pixel design: purple sky, wizard hat with gold band, star on the tip, sparkles.
const P = { '.': null, b: [0x12, 0x0c, 0x34], B: [0x2c, 0x24, 0x92], h: [0x3b, 0x32, 0xb8], H: [0x1e, 0x1a, 0x6a], g: [0xff, 0xcc, 0x33], G: [0xb8, 0x86, 0x2a], w: [0xff, 0xf6, 0xdc], c: [0x4d, 0xe1, 0xff], k: [0x0a, 0x06, 0x20] };
const ART = [
  '................................',
  '..............c.................',
  '.............ccc.......w........',
  '..............c.................',
  '.......w...........kk...........',
  '..................kggk..........',
  '.................kggggk.........',
  '..................kggk.....c....',
  '...................kk...........',
  '..................khhk..........',
  '.................khhhhk.........',
  '.................khhhhk.........',
  '................khhhhhhk........',
  '................khhhHhhk........',
  '...............khhhhHhhhk.......',
  '...............khhhhhHhhk.......',
  '..............khhhhhhHhhhk......',
  '..............kgggggggggggk.....',
  '.............kgGgggggggggGgk....',
  '.............khhhhhhhhhhhhhk....',
  '............khhhhhhhhhhhhhhhk...',
  '............khhhhhhhHHhhhhhhk...',
  '...........khhhhhhhhhHHhhhhhhk..',
  '..........khhhhhhhhhhhHHhhhhhhk.',
  '.........kkhhhhhhhhhhhhhhhhhhkk.',
  '........kBBBkkkkkkkkkkkkkkkkBBBk',
  '.......kBBBBBBBBBBBBBBBBBBBBBBBk',
  '........kkBBBBBBBBBBBBBBBBBBBkk.',
  '..........kkkkkkkkkkkkkkkkkkk...',
  '.....w..........................',
  '..........................c.....',
  '................................',
];

function paint(width, height, scale, offX, offY) {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Vertical gradient background with a soft glow behind the hat.
      const t = y / height;
      let r = Math.round(0x2c * (1 - t) + 0x12 * t), g = Math.round(0x24 * (1 - t) + 0x0c * t), b = Math.round(0x92 * (1 - t) + 0x34 * t);
      const dx = (x - width / 2) / (width / 2), dy = (y - height * 0.55) / (height / 2);
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.6) * 0.35;
      r = Math.min(255, r + 255 * glow * 0.9); g = Math.min(255, g + 204 * glow * 0.9); b = Math.min(255, b + 51 * glow * 0.4);
      const px = Math.floor((x - offX) / scale), py = Math.floor((y - offY) / scale);
      const ch = ART[py]?.[px];
      const col = ch ? P[ch] : null;
      const i = (y * width + x) * 4;
      if (col) { buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; } else { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; }
      buf[i + 3] = 255;
    }
  }
  return buf;
}

mkdirSync(new URL('../resources/', import.meta.url), { recursive: true });
const out = (name, w, h, scale, ox, oy) => writeFileSync(new URL(`../resources/${name}`, import.meta.url), png(w, h, paint(w, h, scale, ox, oy)));
out('icon.png', 1024, 1024, 28, (1024 - 32 * 28) / 2, (1024 - 32 * 28) / 2);
out('icon-foreground.png', 1024, 1024, 22, (1024 - 32 * 22) / 2, (1024 - 32 * 22) / 2);
out('icon-background.png', 1024, 1024, 0, -99999, -99999);
out('splash.png', 2732, 2732, 32, (2732 - 32 * 32) / 2, (2732 - 32 * 32) / 2);
out('splash-dark.png', 2732, 2732, 32, (2732 - 32 * 32) / 2, (2732 - 32 * 32) / 2);
out('feature.png', 1024, 500, 14, 40, (500 - 32 * 14) / 2);
console.log('wrote resources/icon.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png, feature.png');
