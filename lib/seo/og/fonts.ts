import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The vendored brand faces the OG cards are drawn with. Satori embeds glyph
 * outlines, so it needs the raw font binaries — `next/font` and CSS `@font-face`
 * are both invisible to it.
 *
 * Node runtime only: this reads off disk. Read once per instance and cached,
 * because the two faces are ~180KB together and every card render needs both.
 */

// Relative to the project root, which is where Next runs the server from.
const FONT_DIR = 'app/api/og/macro-card/_fonts';

export interface OgFonts {
  lora: ArrayBuffer;
  dmSans: ArrayBuffer;
}

let fontCache: Promise<OgFonts> | null = null;

/** Detach a Node Buffer's bytes into a standalone ArrayBuffer for Satori. */
function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export async function loadOgFonts(): Promise<OgFonts> {
  fontCache ??= (async () => {
    const dir = join(process.cwd(), FONT_DIR);
    const [lora, dmSans] = await Promise.all([
      readFile(join(dir, 'Lora-Regular.ttf')),
      readFile(join(dir, 'DMSans-Bold.ttf')),
    ]);
    return { lora: toArrayBuffer(lora), dmSans: toArrayBuffer(dmSans) };
  })();
  return fontCache;
}
