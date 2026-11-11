'use client';

import { Loader2 } from 'lucide-react';

/** "Looking up" / "Reading the label": one line anchored under the scan window
 *  while the darkened frame waits — the Flutter app's `ScanLoadingOverlay`. */
export function ScanBusyOverlay({ text }: { text: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute top-[calc(100%+20px)] left-1/2 flex -translate-x-1/2 items-center justify-center gap-2.5 whitespace-nowrap text-[16px] text-white"
    >
      <Loader2 className="size-icon-action animate-spin" />
      {text}
    </p>
  );
}
