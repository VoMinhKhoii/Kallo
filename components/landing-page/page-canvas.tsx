'use client';

import { useRef, useState } from 'react';
import { Painting } from '@/components/landing-page/painting';
import { useScrollFrame } from '@/hooks/landing/use-scroll-frame';

/** How much paper covers the painting once past the hero. */
const VEIL = 0.6;

const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** The painting at 32px, in the HTML, so its colours are in the first paint. */
const PAINTING_BLUR =
  'data:image/webp;base64,UklGRoAAAABXRUJQVlA4IHQAAADwBACdASogABgAPu1kqk2ppaQiMAgBMB2JQBbcajgLFqxmIG2MZwpuJbvZMwG36s4A/q4c/1wGITX19bobqlMz1w0GmXCtQA3b7msU2TH1SZVTsQ8AuakMDRRxIHL6WZpX3YDAr9eFe0u2BM6YYIBU6IAAAA==';

/**
 * Monet's Stacks of Wheat, as one canvas behind the whole page.
 *
 * Fixed and mounted once, so no section owns a picture and there is never a
 * seam between two of them. Scrolling lays a light paper veil over the hero's
 * full painting and dissolves it into another of the series, the same field
 * in different light, which waits for the first scroll so it never competes
 * with the hero on first load. `veiled` is for a page with no hero to show the
 * painting at full strength: the veil is there from the first paint.
 */
export function PageCanvas({ veiled = false }: { veiled?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const summerRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const [later, setLater] = useState(false);

  useScrollFrame(() => {
    const room = document.documentElement.scrollHeight - window.innerHeight;
    const page = room > 0 ? window.scrollY / room : 0;
    if (window.scrollY > 120) setLater(true);
    if (veilRef.current) {
      const veil = veiled
        ? VEIL
        : smooth(0, window.innerHeight * 0.95, window.scrollY) * VEIL;
      veilRef.current.style.opacity = String(veil);
    }
    if (summerRef.current) {
      summerRef.current.style.opacity = String(smooth(0.15, 0.75, page));
    }
    if (
      stageRef.current &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      stageRef.current.style.transform = `scale(${1 + page * 0.1})`;
    }
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[100lvh] overflow-hidden"
    >
      <div ref={stageRef} className="absolute inset-0 origin-[50%_35%]">
        <Painting name="stacks-of-wheat" blurDataURL={PAINTING_BLUR} eager />
        <div ref={summerRef} className="absolute inset-0 opacity-0">
          {later ? <Painting name="stacks-of-wheat-summer" /> : null}
        </div>
      </div>
      <div
        ref={veilRef}
        className="absolute inset-0 bg-kallo-surface dark:bg-kallo-surface/55"
        style={{ opacity: veiled ? VEIL : 0 }}
      />
    </div>
  );
}
