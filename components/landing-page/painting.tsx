import { getImageProps } from 'next/image';

const COVER = 'object-cover object-[68%_0] md:object-top dark:brightness-[0.6]';
/** The `srcSet` width crawlers get as `src` (see `fallbackSrc`). */
const FALLBACK_WIDTH = 828;

interface PaintingProps {
  /** Each needs `.webp`, `-1920.avif` and `-1200.avif` in `public/landing/hero/`. */
  name: 'stacks-of-wheat' | 'stacks-of-wheat-summer';
  /** Inline thumbnail shown until the painting has arrived. */
  blurDataURL?: string;
  /** For the first painting on screen. */
  eager?: boolean;
}

/**
 * One full-bleed painting as ready-made AVIF, with the resized WebP as the
 * fallback for browsers without AVIF.
 *
 * AVIF is the point, not only for its size: Chrome draws WebP as the bytes
 * arrive, which showed a sharp band creeping down over the blurred thumbnail.
 * It draws a whole AVIF at once. Files are the WebP master through sharp at
 * those widths, AVIF quality 50.
 *
 * `getImageProps` never removes the blur background. That is fine only because
 * a painting is opaque and covers it, so keep every painting that way.
 */
export function Painting({ name, blurDataURL, eager = false }: PaintingProps) {
  const { props } = getImageProps({
    src: `/landing/hero/${name}.webp`,
    alt: '',
    fill: true,
    sizes: '100vw',
    className: COVER,
    loading: eager ? 'eager' : 'lazy',
    fetchPriority: eager ? 'low' : undefined,
    placeholder: blurDataURL ? 'blur' : 'empty',
    blurDataURL,
  });

  return (
    <picture>
      <source
        type="image/avif"
        media="(min-width: 768px)"
        srcSet={`/landing/hero/${name}-1920.avif`}
      />
      <source type="image/avif" srcSet={`/landing/hero/${name}-1200.avif`} />
      <img {...props} src={fallbackSrc(props.srcSet) ?? props.src} alt="" />
    </picture>
  );
}

/**
 * Browsers choose from `srcSet`; only crawlers read `src`. next/image points
 * `src` at its widest size, which is a 1.3 MB JPEG for a client that names no
 * image format, so crawlers get the 828w entry (about 60 KB) instead.
 */
function fallbackSrc(srcSet: string | undefined): string | undefined {
  return srcSet
    ?.split(', ')
    .find((entry) => entry.endsWith(` ${FALLBACK_WIDTH}w`))
    ?.split(' ')[0];
}
