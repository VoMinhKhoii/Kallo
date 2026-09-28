'use client';

import type { RefObject } from 'react';
import { BARCODE_SCANNER_ELEMENT_ID } from '@/hooks/ui/use-barcode-camera-scanner';
import { cn } from '@/lib/core/ui/cn';
import type { ScanMode } from '../scan-view';

/**
 * The camera, filling the dialog — the Flutter app's camera layers: the live
 * picture, or the frame a code was read in / the photo being read, held under
 * its result so the thing scanned stays in view. The scan window is a thin
 * white outline with a light dim outside it: wide for a barcode, tall for a
 * label.
 */
export function ScanCameraStage({
  mode,
  held,
  labelVideoRef,
  problem,
  dimmed,
}: {
  mode: ScanMode;
  /** The frame a code was read in, or the label photo — a data/blob URL. */
  held: string | null;
  labelVideoRef: RefObject<HTMLVideoElement | null>;
  /** Why there is no picture: the camera was refused or would not start. */
  problem: string | null;
  /** "Looking up" / "Reading": the frame darkens under the spinner. */
  dimmed: boolean;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {mode === 'barcode' ? (
        <div
          id={BARCODE_SCANNER_ELEMENT_ID}
          className="[&_#qr-shaded-region]:hidden! absolute inset-0 [&_video]:size-full! [&_video]:object-cover"
        />
      ) : (
        <video
          ref={labelVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {held && (
        // biome-ignore lint/performance/noImgElement: a blob/data URL of the user's own camera frame; next/image cannot optimise it.
        <img
          src={held}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {!held && problem && (
        <p className="absolute inset-x-10 top-1/2 -translate-y-1/2 text-center text-[16px] text-white leading-6">
          {problem}
        </p>
      )}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[22px] border-[1.5px] border-white shadow-[0_0_0_100vmax_rgba(0,0,0,0.22)]',
          mode === 'barcode'
            ? 'aspect-[1.9] w-[74%]'
            : 'aspect-[0.72] max-h-[62%] w-[70%]',
          held && !dimmed && 'border-white/70'
        )}
      />
      {dimmed && <div className="absolute inset-0 bg-black/30" />}
    </div>
  );
}
