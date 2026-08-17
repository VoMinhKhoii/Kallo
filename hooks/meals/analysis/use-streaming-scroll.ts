'use client';

import { useEffect } from 'react';
import type { useStreamAnalysis } from '@/hooks/meals/analysis/use-stream-analysis';

/** Auto-scroll the feed as the streaming card grows. */
export function useStreamingScroll(args: {
  stream: ReturnType<typeof useStreamAnalysis>;
  scrollToBottom: () => void;
}) {
  const { stream, scrollToBottom } = args;
  const streamItemCount = stream.items.length + stream.completedItems.length;
  useEffect(() => {
    if (stream.isAnalyzing && streamItemCount > 0) {
      scrollToBottom();
    }
  }, [stream.isAnalyzing, streamItemCount, scrollToBottom]);
}
