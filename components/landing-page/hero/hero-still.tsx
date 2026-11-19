'use client';

import { preload } from 'react-dom';

const PHONE = '(max-width: 767px)';
const WIDE = '(min-width: 768px)';

/**
 * The hero film's opening frame, sitting behind the `<video>`.
 *
 * A `poster` is one file for every screen and starts downloading only when the
 * parser reaches it. This is a phone-sized crop on a phone, and the preload puts
 * it in the `<head>`, so it is the first thing fetched after the HTML. It stays
 * visible until the film paints over it, or for good if the film never plays.
 */
export function HeroStill({ phone, wide }: { phone: string; wide: string }) {
  preload(phone, { as: 'image', media: PHONE, fetchPriority: 'high' });
  preload(wide, { as: 'image', media: WIDE, fetchPriority: 'high' });

  return (
    <picture>
      <source media={PHONE} srcSet={phone} />
      <img
        src={wide}
        alt=""
        fetchPriority="high"
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  );
}
