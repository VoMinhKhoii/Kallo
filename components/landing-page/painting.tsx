import { getImageProps } from 'next/image';

const COVER = 'object-cover object-[68%_0] md:object-top dark:brightness-[0.6]';

interface PaintingProps {
  /** File name in `public/landing/hero/`, without width or extension. */
  name: string;
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
 * It draws a whole AVIF at once.
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
      <img {...props} alt="" />
    </picture>
  );
}
