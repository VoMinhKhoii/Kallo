// ---------------------------------------------------------------------------
// Avatar re-encode — normalize every upload to a small square WebP
// ---------------------------------------------------------------------------
// Avatars render at ≤64px but phone photos arrive at 2–5 MB; re-encoding
// server-side cuts each object to a few KB (feeds fetch them repeatedly) and
// strips EXIF metadata (GPS position) as a side effect. Decoding through
// sharp also hard-verifies the bytes are a real image — stronger than the
// magic-byte prefilter.

import sharp from 'sharp';

/** Longest edge of a stored avatar — 8x the largest render size (64px),
 * comfortable for retina displays. */
const AVATAR_EDGE_PX = 512;
const WEBP_QUALITY = 82;

/**
 * Decode, auto-orient (EXIF rotation), center-crop to a square, resize to
 * 512px, and re-encode as WebP. Throws on undecodable input — the caller
 * maps that to a validation error.
 */
export async function processAvatarImage(bytes: Uint8Array): Promise<Buffer> {
  return sharp(bytes)
    .rotate()
    .resize(AVATAR_EDGE_PX, AVATAR_EDGE_PX, {
      fit: 'cover',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
