'use client';

import { useEffect, useRef, useState } from 'react';

export function useDashboardMeasurements() {
  const [progressWidth, setProgressWidth] = useState<number | null>(null);
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
          const width = entry.contentRect.width;
          if (width > 0) {
            setProgressWidth((current) =>
              current === width ? current : width
            );
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
    progressWidth,
    heatmapSize,
    hasMeasuredProgress: progressWidth !== null,
    hasMeasuredHeatmap: heatmapSize !== null,
  };
}
