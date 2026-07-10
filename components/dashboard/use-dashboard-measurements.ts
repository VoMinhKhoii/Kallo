'use client';

import { useEffect, useRef, useState } from 'react';

export function useDashboardMeasurements() {
  // The progress container's exact width is no longer needed (the weight range
  // is fixed at 30d) — only "has it laid out yet?", which gates the query. Track
  // a boolean so repeated resizes don't re-render the whole shell.
  const [hasMeasuredProgress, setHasMeasuredProgress] = useState(false);
  const [heatmapSize, setHeatmapSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const heatmapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const progressNode = progressContainerRef.current;
    const heatmapNode = heatmapContainerRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === progressNode) {
          if (entry.contentRect.width > 0) {
            // Idempotent: React bails out once it's already true.
            setHasMeasuredProgress(true);
          }
          continue;
        }

        if (entry.target === heatmapNode) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            setHeatmapSize((current) =>
              current?.width === width && current.height === height
                ? current
                : { width, height }
            );
          }
        }
      }
    });

    if (progressNode) observer.observe(progressNode);
    if (heatmapNode) observer.observe(heatmapNode);
    return () => observer.disconnect();
  }, []);

  return {
    progressContainerRef,
    heatmapContainerRef,
    heatmapSize,
    hasMeasuredProgress,
    hasMeasuredHeatmap: heatmapSize !== null,
  };
}
