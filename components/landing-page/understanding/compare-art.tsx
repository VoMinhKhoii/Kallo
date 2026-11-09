'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useNearViewport } from '@/hooks/landing/use-near-viewport';

/**
 * The painting behind the right-hand card, mounted only as it comes near.
 *
 * It is warmth in the paper rather than content, and these cards sit far below
 * the fold: left to the browser, all of them download with the first load and
 * compete with the hero and the scripts on a slow connection.
 */
export function CompareArt({
  src,
  opacity,
}: {
  src: Parameters<typeof Image>[0]['src'];
  opacity: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const near = useNearViewport(boxRef, '800px');

  return (
    <div ref={boxRef} className="absolute inset-0 -z-10">
      {near ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 768px) 45vw, 90vw"
          style={{ opacity }}
          // A tint on a dark card, as on the hero's (`!` beats the inline style).
          className="object-cover dark:opacity-[0.14]!"
        />
      ) : null}
    </div>
  );
}
