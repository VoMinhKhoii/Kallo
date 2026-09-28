'use client';

import { Loader2 } from 'lucide-react';

/** "Looking up" / "Reading the label": one line under the scan window while
 *  the darkened frame waits — the Flutter app's `ScanLoadingOverlay`. */
export function ScanBusyOverlay({ text }: { text: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="absolute inset-x-0 top-[64%] flex items-center justify-center gap-2.5 text-[16px] text-white"
    >
      <Loader2 className="size-[18px] animate-spin" />
      {text}
    </p>
  );
}
