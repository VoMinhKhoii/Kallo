// ---------------------------------------------------------------------------
// Image upload validation — shared by feedback screenshots and profile avatars
// ---------------------------------------------------------------------------
// Pure, dependency-free helpers (no 'use server', no DB) so both server
// actions and API routes can import them.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Allowed image content types → file extension. */
export const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** File-signature (magic-byte) check so a spoofed Content-Type can't smuggle a
 * non-image (e.g. SVG/HTML) past the allowlist. */
export function signatureMatches(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case 'image/png':
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );
    case 'image/jpeg':
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    case 'image/webp':
      // "RIFF" .... "WEBP"
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}
