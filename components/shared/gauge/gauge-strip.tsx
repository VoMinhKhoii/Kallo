'use client';

import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { MOBILE_QUERY } from '@/lib/core/ui/breakpoints';
import {
  sizeAtCap,
  sizeStrip,
  stripHeight,
} from '@/lib/core/ui/gauge-strip-metrics';
import { type StripDay, StripRow } from './gauge-strip-row';

/**
 * The day as one row of marks: the calorie dial, then the same arc in each
 * macro's own pigment.
 *
 * This owns all four, which is the point. They used to be two components that
 * happened to sit next to each other — a calorie dial, then a macro row inside
 * a `flex-1` box that centred its three fixed-size dials in whatever was left.
 * On a wide viewport that opened ~290px of nothing between them and grew with
 * the window. Sizing the whole cluster from one rule is what closes it: the
 * marks grow into the room until the surface's cap binds, and only then does
 * the cluster centre. See `lib/core/ui/gauge-strip-layout.ts` for how big, and
 * `gauge-strip-metrics.ts` for where they sit.
 *
 * Loosely mirrors `apps/mobile-flutter/lib/shared/widgets/gauge/macro_dial_row.dart`,
 * which shrinks its dials to fit a narrow phone. This is the same idea with the
 * cap raised, so the marks also grow on a desktop.
 */

/**
 * The measurement wants to land before paint, but a layout effect warns when
 * React renders this on the server — where there is no layout to read anyway.
 * The server pass takes the effect-free branch and renders the spacer.
 */
const useMeasureEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface GaugeStripProps extends StripDay {
  /** This surface's ceiling on a macro dial's radius. */
  macroCap: number;
  /** Stack the calorie dial over the macros while the viewport is a phone's
   *  (below `md`) — the Flutter Today layout. */
  stackOnPhone?: boolean;
}

export function GaugeStrip({
  macroCap,
  stackOnPhone = false,
  ...day
}: GaugeStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [isPhone, setIsPhone] = useState(false);

  // Before paint, so the strip never renders at one size and visibly jumps to
  // another.
  useMeasureEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = (width: number) => {
      if (width > 0) {
        setAvailable((previous) => (previous === width ? previous : width));
      }
      // Read with the width, so a phone never paints the one-line form first.
      setIsPhone(window.matchMedia?.(MOBILE_QUERY).matches ?? false);
    };

    // Measure once up front: the observer's first callback is async in some
    // browsers, and an environment without layout never delivers one at all.
    measure(node.getBoundingClientRect().width || node.clientWidth);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      measure(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full" data-testid="gauge-strip" ref={containerRef}>
      {available === null ? (
        // Before the first measurement the strip reserves the height it will
        // take at this surface's cap, so nothing below it moves when it lands.
        // A surface that stacks on phones reserves the stacked height below md
        // in CSS, so the server-rendered placeholder is already the right size.
        <div
          className={
            stackOnPhone
              ? 'h-(--strip-phone) md:h-(--strip-wide)'
              : 'h-(--strip-wide)'
          }
          style={
            {
              '--strip-wide': `${stripHeight(sizeAtCap(macroCap))}px`,
              '--strip-phone': `${stripHeight(sizeAtCap(macroCap, true))}px`,
            } as CSSProperties
          }
        />
      ) : (
        <StripRow
          {...day}
          sizes={sizeStrip(available, macroCap, stackOnPhone && isPhone)}
        />
      )}
    </div>
  );
}
