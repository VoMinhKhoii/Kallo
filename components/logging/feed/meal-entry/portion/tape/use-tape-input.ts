'use client';

import { useRef, useState } from 'react';
import type { PortionAnchor } from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { TAPE_MINORS, type tapeScale } from './vessel-tape-geometry';

/**
 * The tape's input: drag it (the value follows the finger, fraction for
 * fraction of the tape's width), tap it (jump to the vessel nearest the tap),
 * or step one graduation with the arrow keys. Returns the handlers to spread on
 * the slider and whether a drag is in progress (no easing while it is).
 */
export function useTapeInput({
  anchors,
  scale,
  width,
  grams,
  onChange,
}: {
  anchors: PortionAnchor[];
  scale: ReturnType<typeof tapeScale>;
  width: number;
  grams: number;
  onChange: (grams: number) => void;
}) {
  const drag = useRef<{ x: number; fraction: number; moved: boolean } | null>(
    null
  );
  const [dragging, setDragging] = useState(false);
  const fraction = scale.toFraction(grams);
  const graduation = 1 / (TAPE_MINORS * anchors.length);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const end = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    return d;
  };

  const handlers = {
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      const direction =
        event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? -1
            : 0;
      if (!direction) return;
      event.preventDefault();
      onChange(scale.toGrams(clamp(fraction + direction * graduation)));
    },
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = { x: event.clientX, fraction, moved: false };
      setDragging(true);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const dx = event.clientX - d.x;
      if (Math.abs(dx) > 4) d.moved = true;
      if (d.moved)
        onChange(Math.max(1, scale.toGrams(clamp(d.fraction - dx / width))));
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      const d = end();
      if (!d || d.moved) return;
      const box = event.currentTarget.getBoundingClientRect();
      const tapped =
        d.fraction + (event.clientX - box.left - box.width / 2) / width;
      const nearest = scale.centres.reduce(
        (best, centre, i) =>
          Math.abs(centre - tapped) < Math.abs(scale.centres[best] - tapped)
            ? i
            : best,
        0
      );
      onChange(Math.round(anchors[nearest].value));
    },
    onPointerCancel: () => {
      end();
    },
  };
  return { fraction, dragging, handlers };
}
