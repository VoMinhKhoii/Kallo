'use client';

import { useTranslations } from 'next-intl';
import { getStreamingPhaseLabel } from '@/components/logging/feed/streaming/streaming-phase-label';
import type { StreamStatus } from '@/lib/ai/streaming/types';

interface AnalysisStageBannerProps {
  status: StreamStatus;
  items: string[];
}

export function AnalysisStageBanner({
  status,
  items,
}: AnalysisStageBannerProps) {
  const t = useTranslations('logging.streaming');

  if (status === 'idle' || status === 'done' || status === 'error') {
    return null;
  }

  const label = getStreamingPhaseLabel(t, status);

  return (
    <div
      className="relative"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-2xl border border-nham-border/30 bg-white p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-nham-accent border-t-transparent" />
          <span className="font-medium text-nham-text-muted text-sm">
            {label}
          </span>
        </div>

        {items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span
                key={item}
                className="rounded-full border border-nham-border bg-white px-2.5 py-0.5 text-nham-text-muted text-xs"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
