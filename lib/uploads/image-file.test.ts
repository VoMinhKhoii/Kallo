import { describe, expect, it } from 'vitest';
import { IMAGE_TYPES, signatureMatches } from './image-file';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe('signatureMatches', () => {
  it('accepts matching magic bytes for each allowed type', () => {
    expect(signatureMatches(PNG, 'image/png')).toBe(true);
    expect(signatureMatches(JPEG, 'image/jpeg')).toBe(true);
    expect(signatureMatches(WEBP, 'image/webp')).toBe(true);
  });

  it('rejects a mismatched signature (spoofed content type)', () => {
    expect(signatureMatches(JPEG, 'image/png')).toBe(false);
    expect(signatureMatches(PNG, 'image/webp')).toBe(false);
  });

  it('rejects unknown mime types and truncated bytes', () => {
    expect(signatureMatches(PNG, 'image/svg+xml')).toBe(false);
    expect(signatureMatches(PNG.slice(0, 2), 'image/png')).toBe(false);
    expect(signatureMatches(new Uint8Array(0), 'image/jpeg')).toBe(false);
  });
});

describe('IMAGE_TYPES', () => {
  it('maps the three allowed types to extensions', () => {
    expect(IMAGE_TYPES).toEqual({
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    });
  });
});
