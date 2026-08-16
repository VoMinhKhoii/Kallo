#!/usr/bin/env node
/**
 * Regenerates the mobile splash images from the Kallo mark.
 *
 * The splash used to be the app-icon tile — a cream K on an espresso
 * (#2C2416) rounded square — which reads as black on the cream launch page.
 * These are the mark ALONE in brand umber (#695E4E) on transparency, so the
 * page colour shows through: iOS's LaunchScreen storyboard and Android's
 * `@color/launch_background` already paint cream behind it.
 *
 * The geometry is `docs/brand/kallo/assets/kallo-mark.svg` verbatim — three
 * straight-edged polygons in a 656x708 viewBox, which is why this can rasterise
 * with zlib and a scanline fill instead of pulling in a full SVG renderer.
 *
 *   node scripts/gen-splash-mark.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const MOBILE = path.join(REPO_ROOT, 'apps/mobile-flutter');

/** Brand umber. The palette is documented in docs/brand/kallo/assets/README.md. */
const UMBER = [0x69, 0x5e, 0x4e];

/** The mark's viewBox, and its three polygons: stem, upper arm, leg. */
const VIEW = { w: 656, h: 708 };
const POLYS = [
  [
    [0, 0],
    [168, 0],
    [168, 708],
    [0, 708],
  ],
  [
    [424, 0],
    [638, 0],
    [410, 277],
    [196, 277],
  ],
  [
    [196, 389],
    [419, 389],
    [656, 708],
    [433, 708],
  ],
];

/** Supersampling factor per axis — 4x4 gives clean diagonals on the arm/leg. */
const SS = 4;

/** Coverage of the mark at (x, y) in [0, 1], sampled on an SS x SS grid. */
function coverage(x, y, scale) {
  let hits = 0;
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      // Sample at subpixel centres, mapped back into viewBox units.
      const px = (x + (sx + 0.5) / SS) / scale;
      const py = (y + (sy + 0.5) / SS) / scale;
      if (POLYS.some((poly) => inside(px, py, poly))) hits++;
    }
  }
  return hits / (SS * SS);
}

/** Even-odd point-in-polygon. */
function inside(px, py, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** An RGBA PNG of the mark, `height` px tall, on transparency. */
function render(height) {
  const scale = height / VIEW.h;
  const width = Math.round(VIEW.w * scale);
  // One filter byte (0 = None) per row, then RGBA.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const a = coverage(x, y, scale);
      // Premultiplication is not used by PNG; store straight colour + alpha.
      raw[o++] = UMBER[0];
      raw[o++] = UMBER[1];
      raw[o++] = UMBER[2];
      raw[o++] = Math.round(a * 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Targets. The mark stands ~88pt tall — a little larger than the 64pt mark
 * inside the old tile, since it no longer has a tile to sit in.
 */
const BASE_PT = 88;
const TARGETS = [
  ['ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage.png', 1],
  ['ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@2x.png', 2],
  ['ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage@3x.png', 3],
  ['android/app/src/main/res/drawable-mdpi/launch_image.png', 1],
  ['android/app/src/main/res/drawable-hdpi/launch_image.png', 1.5],
  ['android/app/src/main/res/drawable-xhdpi/launch_image.png', 2],
  ['android/app/src/main/res/drawable-xxhdpi/launch_image.png', 3],
  ['android/app/src/main/res/drawable-xxxhdpi/launch_image.png', 4],
];

for (const [rel, density] of TARGETS) {
  const out = path.join(MOBILE, rel);
  mkdirSync(path.dirname(out), { recursive: true });
  const png = render(Math.round(BASE_PT * density));
  writeFileSync(out, png);
  console.log(`${rel} — ${Math.round(BASE_PT * density)}px tall`);
}
