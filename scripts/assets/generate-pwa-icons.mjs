// Generates the Kallo PWA / app icons from the brand "Nh" mark.
//
// The mark is the Lora "Nh" ligature in espresso ink on a warm tan disc over a
// cream surface (brand palette: cream #fefbf6, espresso #2C2416, tan #c9a87c).
//
// Outputs (all written to public/):
//   - icon-192.png            192x192, purpose "any"
//   - icon-512.png            512x512, purpose "any"
//   - icon-maskable-512.png   512x512, purpose "maskable" (mark inside ~80% safe area)
//   - apple-icon.png          180x180, NO transparency (iOS masks corners itself)
//
// Run with the project-local sharp:
//   bun --bun scripts/assets/generate-pwa-icons.mjs
// (plain `bun` may resolve a mismatched globally-cached sharp; `--bun` or `node`
// both resolve the project-local install, which ships the matching libvips.)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const publicDir = join(root, 'public');

// Brand palette.
const CREAM = '#fefbf6';
const TAN = '#c9a87c';
const INK = '#2C2416';

// Embed Lora so the "Nh" renders identically regardless of host fonts.
const loraPath = join(root, 'app/api/og/macro-card/_fonts/Lora-Regular.ttf');
const loraB64 = readFileSync(loraPath).toString('base64');

/**
 * Build the icon SVG at a 512 design grid.
 * @param {object} opts
 * @param {number} opts.discScale  disc diameter as a fraction of the canvas
 * @param {boolean} opts.transparentBg  true for transparent corners (PNG "any"),
 *   false for a solid cream background (apple / maskable)
 */
function iconSvg({ discScale, transparentBg }) {
  const size = 512;
  const center = size / 2;
  const discRadius = (size * discScale) / 2;
  // Type sits at ~62% of the disc diameter; tuned so "Nh" fills the disc warmly
  // without crowding the edge.
  const fontSize = discRadius * 2 * 0.62;
  const bg = transparentBg
    ? ''
    : `<rect width="${size}" height="${size}" fill="${CREAM}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      @font-face {
        font-family: 'LoraNh';
        src: url('data:font/ttf;base64,${loraB64}') format('truetype');
        font-weight: 400;
      }
      .nh {
        font-family: 'LoraNh', Georgia, serif;
        font-weight: 400;
        letter-spacing: -0.02em;
      }
    </style>
  </defs>
  ${bg}
  <circle cx="${center}" cy="${center}" r="${discRadius}" fill="${TAN}"/>
  <text class="nh" x="${center}" y="${center}" font-size="${fontSize.toFixed(1)}"
    fill="${INK}" text-anchor="middle" dominant-baseline="central">Nh</text>
</svg>`;
}

async function render(svg, size, outFile) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await sharp(buf).toFile(join(publicDir, outFile));
  return buf.length;
}

async function main() {
  // Standard icons ("any"): transparent corners, generous tan disc (78%).
  const standard = iconSvg({ discScale: 0.78, transparentBg: true });
  // Maskable: smaller disc (62%) so the mark stays inside the ~80% safe area,
  // on a solid cream field so the OS-masked corners stay on-brand (never clear).
  const maskable = iconSvg({ discScale: 0.62, transparentBg: false });
  // Apple: solid cream background (iOS does not honor transparency and masks
  // the corners itself), disc sized like the standard icon.
  const apple = iconSvg({ discScale: 0.78, transparentBg: false });

  const results = await Promise.all([
    render(standard, 192, 'icon-192.png'),
    render(standard, 512, 'icon-512.png'),
    render(maskable, 512, 'icon-maskable-512.png'),
    render(apple, 180, 'apple-icon.png'),
  ]);

  const names = [
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'apple-icon.png',
  ];
  for (let i = 0; i < names.length; i++) {
    console.log(`wrote public/${names[i]} (${results[i]} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
