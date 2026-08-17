import { describe, expect, it } from 'vitest';
import { tryDecodeFontEncodedBarcode } from '../decode';

describe('tryDecodeFontEncodedBarcode', () => {
  it('returns pure numeric string as-is', () => {
    expect(tryDecodeFontEncodedBarcode('8934563138162')).toBe('8934563138162');
    expect(tryDecodeFontEncodedBarcode('123456')).toBe('123456');
  });

  it('correctly decodes Libre Barcode 128 / IDAutomation Excel font-encoded string', () => {
    // C")"(@¹:
    // C (67) -> val = 67 - 32 = 35 -> "35"
    // " (34) -> val = 34 - 32 = 2 -> "02"
    // ) (41) -> val = 41 - 32 = 9 -> "09"
    // " (34) -> val = 34 - 32 = 2 -> "02"
    // ( (40) -> val = 40 - 32 = 8 -> "08"
    // @ (64) -> val = 64 - 32 = 32 -> "32"
    // ¹ (185) -> val = 85 -> "85"
    // Expected decoded: 35020902083285
    expect(tryDecodeFontEncodedBarcode('C")"(@¹')).toBe('35020902083285');
  });

  it('falls back to stripping non-digits if character map fails but digits exist', () => {
    expect(tryDecodeFontEncodedBarcode('barcode-12345678-xyz')).toBe(
      '12345678'
    );
  });

  it('returns original input if no decoding is possible and no digits exist', () => {
    expect(tryDecodeFontEncodedBarcode('abcde')).toBe('abcde');
  });
});
