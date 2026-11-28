'use client';

import type { RefObject } from 'react';
import { BARCODE_SCANNER_ELEMENT_ID } from '@/hooks/ui/use-barcode-camera-scanner';
import { cn } from '@/lib/core/ui/cn';
import type { ScanMode } from '../view';
import { ScanBusyOverlay } from './busy-overlay';

/**
 * The camera, filling the dialog — the Flutter app's camera layers: the live
 * picture, or the frame a code was read in / the photo being read, held under
 * its result so the thing scanned stays in view. The scan window is a thin
 * white outline with a light dim outside it: wide for a barcode, tall for a
 * label, scaled inside a size-contained clear zone between the top and bottom
 * controls so its aspect ratio never distorts on compact or wide viewports.
 */
export function ScanCameraStage({
  mode,
  held,
  labelVideoRef,
  problem,
  busyText,
}: {
  mode: ScanMode;
  /** The frame a code was read in, or the label photo — a data/blob URL. */
  held: string | null;
  labelVideoRef: RefObject<HTMLVideoElement | null>;
  /** Why there is no picture: the camera was refused or would not start. */
  problem: string | null;
  /** "Looking up" / "Reading": the frame darkens and shows status below the window. */
  busyText: string | null;
}) {
  const dimmed = busyText !== null;
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {mode === 'barcode' ? (
        <div
          id={BARCODE_SCANNER_ELEMENT_ID}
          className="[&_#qr-shaded-region]:hidden! [&_canvas]:hidden! absolute inset-0 [&_video]:size-full! [&_video]:object-cover!"
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
      {dimmed && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-black/30"
        />
      )}
      {!held && problem && (
        <p className="absolute inset-x-10 top-1/2 -translate-y-1/2 text-center text-[16px] text-white leading-6">
          {problem}
        </p>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-[68px] bottom-[148px] flex items-center justify-center [container-type:size] sm:bottom-[156px]">
        <div
          data-testid="scan-camera-window"
          data-mode={mode}
          className={cn(
            'relative transition-[width,height] duration-200 ease-out motion-reduce:transition-none',
            mode === 'barcode'
              ? 'h-[calc(var(--w)/1.9)] w-[var(--w)] [--w:min(78cqw,360px,calc(min(88cqh,100cqh-24px)*1.9))]'
              : 'h-[calc(var(--w)/0.72)] w-[var(--w)] [--w:min(72cqw,320px,calc(min(92cqh,100cqh-24px)*0.72))]'
          )}
        >
          <div
            aria-hidden
            className={cn(
              'absolute inset-0 rounded-[22px] border-[1.5px] border-white shadow-[0_0_0_100vmax_rgba(0,0,0,0.22)] transition-colors duration-200',
              held && !dimmed && 'border-white/70'
            )}
          />
          {busyText ? <ScanBusyOverlay text={busyText} /> : null}
        </div>
      </div>
    </div>
  );
}
