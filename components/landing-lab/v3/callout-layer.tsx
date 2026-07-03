'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ProjectedMarker } from './globe-scene';

/**
 * The annotation layer: a straight elbow leader line from each tour
 * annotation to its country on the globe, ending in a donut dot on the
 * land itself. Updated imperatively from the scene's frame loop (no
 * React state at 60fps).
 *
 * Perf notes, since this runs every frame: element lookups are cached
 * per iso, the shared overlay's opacity is read once per update instead
 * of per line, and the loop is split into a read phase (all
 * getBoundingClientRect) before a write phase (all attribute sets) so
 * style writes never interleave with layout reads.
 */

export interface CalloutLayerHandle {
  update(points: ProjectedMarker[]): void;
}

interface LineEntry {
  group: SVGGElement;
  path: SVGPathElement;
  dot: SVGCircleElement;
  anchor: SVGCircleElement;
  opacity: number;
  card: HTMLElement | null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Bright enough to read on the espresso space backdrop. */
const LINE_COLOR = '#C9A87C';
const ANCHOR_COLOR = '#D9BE93';

function createLine(svg: SVGSVGElement): LineEntry {
  const group = document.createElementNS(SVG_NS, 'g');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', LINE_COLOR);
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'square');
  // Donut endpoint on the country: tan ring, dark core — deliberate,
  // not a stray dot.
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('r', '5');
  dot.setAttribute('fill', 'rgba(36,28,17,0.55)');
  dot.setAttribute('stroke', LINE_COLOR);
  dot.setAttribute('stroke-width', '2.5');
  const anchor = document.createElementNS(SVG_NS, 'circle');
  anchor.setAttribute('r', '3');
  anchor.setAttribute('fill', ANCHOR_COLOR);
  group.append(path, dot, anchor);
  group.style.opacity = '0';
  svg.append(group);
  return { group, path, dot, anchor, opacity: 0, card: null };
}

export const CalloutLayer = forwardRef<CalloutLayerHandle>((_, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const lines = useRef<Map<string, LineEntry>>(new Map());

  useImperativeHandle(ref, () => ({
    update(points: ProjectedMarker[]) {
      const svg = svgRef.current;
      if (!svg) {
        return;
      }

      // ——— Read phase: gather every rect/style before touching the DOM.
      const seen = new Set<string>();
      let overlayOpacity: number | null = null;
      const frames = points.map((point) => {
        seen.add(point.iso);
        let entry = lines.current.get(point.iso);
        if (!entry) {
          entry = createLine(svg);
          lines.current.set(point.iso, entry);
        }
        if (!entry.card?.isConnected) {
          entry.card = document.querySelector<HTMLElement>(
            `[data-card-iso="${point.iso}"]`
          );
        }
        const rect = entry.card?.getBoundingClientRect();
        if (overlayOpacity === null && entry.card) {
          const overlay = entry.card.closest<HTMLElement>(
            '[data-tour-overlay]'
          );
          // Computed, not `.style.opacity`: motion keeps the stale
          // initial value in the inline attribute while animating.
          overlayOpacity = overlay
            ? Number(getComputedStyle(overlay).opacity)
            : 1;
        }
        return { point, entry, rect };
      });
      const sharedOpacity =
        overlayOpacity === null || Number.isNaN(overlayOpacity)
          ? 1
          : overlayOpacity;

      // ——— Write phase.
      for (const { point, entry, rect } of frames) {
        const cardVisible = rect !== undefined && rect.width > 0;
        let target = 0;
        if (cardVisible && point.front && rect) {
          target = Math.min(1, sharedOpacity);
          const fromLeft = rect.right < point.x;
          const startX = fromLeft ? rect.right + 10 : rect.left - 10;
          const startY = rect.top + rect.height / 2;
          // Straight elbow — horizontal run, one perpendicular drop.
          // Column ordering (west/east + north→south) keeps lanes from
          // ever crossing.
          entry.path.setAttribute(
            'd',
            `M ${startX} ${startY} H ${point.x} V ${point.y}`
          );
          entry.dot.setAttribute('cx', String(point.x));
          entry.dot.setAttribute('cy', String(point.y));
          entry.anchor.setAttribute('cx', String(startX));
          entry.anchor.setAttribute('cy', String(startY));
        }
        entry.opacity += (target - entry.opacity) * 0.16;
        entry.group.style.opacity = String(
          entry.opacity < 0.01 ? 0 : entry.opacity * 0.9
        );
      }
      for (const [iso, entry] of lines.current) {
        if (!seen.has(iso)) {
          entry.group.remove();
          lines.current.delete(iso);
        }
      }
    },
  }));

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
});

CalloutLayer.displayName = 'CalloutLayer';
