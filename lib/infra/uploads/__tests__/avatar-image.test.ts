import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processAvatarImage } from '../avatar-image';

const WEBP_MAGIC = (bytes: Buffer) =>
  bytes.length >= 12 &&
  bytes.toString('ascii', 0, 4) === 'RIFF' &&
  bytes.toString('ascii', 8, 12) === 'WEBP';

async function testPng(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 150, b: 100 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

describe('processAvatarImage', () => {
  it('re-encodes to a 512px square WebP', async () => {
    const out = await processAvatarImage(await testPng(1600, 900));
    expect(WEBP_MAGIC(out)).toBe(true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('does not enlarge a source smaller than the target', async () => {
    const out = await processAvatarImage(await testPng(100, 100));
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it('throws on undecodable bytes', async () => {
    const junk = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]);
    await expect(processAvatarImage(junk)).rejects.toThrow();
  });
});
