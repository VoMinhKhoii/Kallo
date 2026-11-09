'use client';

import { useEffect, useRef, useState } from 'react';
import { useNearViewport } from '@/hooks/landing/use-near-viewport';
import { cn } from '@/lib/core/ui/cn';
import type { LandingClip } from './media';

/** Reduced motion, data saver or a very slow connection: stills, no film. */
function readStillOnly(): boolean {
  if (typeof window === 'undefined') return false;
  const { connection } = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    connection?.saveData === true ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === 'slow-2g'
  );
}

/**
 * A muted product loop that is ready before you reach it.
 *
 * It starts downloading well ahead of the viewport, and plays from its first
 * frame only once it is properly on screen, so a visitor never lands mid-clip
 * or waits on a blank frame. It pauses off screen and restarts on return.
 * Reduced motion, data saver and a very slow connection keep the poster, the
 * clip's opening frame. The poster also waits until the frame is near, so the
 * stills far down the page never compete with what is on screen.
 */
export function ProductVideo({
  clip,
  width,
  height,
  label,
  poster = true,
  className,
}: {
  clip: LandingClip;
  width: number;
  height: number;
  label: string;
  /** False when something else behind the video shows the opening frame. */
  poster?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const visibleRef = useRef(false);
  const near = useNearViewport(videoRef, '1200px');
  // Nothing this gates renders until `near`, so the server's `false` is safe.
  const [stillOnly] = useState(readStillOnly);
  const armed = near && !stillOnly;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || stillOnly) return;

    const onScreen = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? false;
        if (visibleRef.current) {
          video.currentTime = 0;
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.45 }
    );
    onScreen.observe(video);
    return () => onScreen.disconnect();
  }, [stillOnly]);

  // Sources added to a mounted <video> are ignored until it is told to reload.
  useEffect(() => {
    if (!armed) return;
    const video = videoRef.current;
    video?.load();
    if (visibleRef.current) void video?.play().catch(() => {});
  }, [armed]);

  return (
    <video
      ref={videoRef}
      aria-label={label}
      poster={poster && near ? clip.poster : undefined}
      width={width}
      height={height}
      muted
      loop
      playsInline
      preload="auto"
      className={cn('block h-auto w-full', className)}
    >
      {armed && clip.mobileSrc ? (
        <source
          src={clip.mobileSrc}
          type="video/mp4"
          media="(max-width: 767px)"
        />
      ) : null}
      {armed ? <source src={clip.src} type="video/mp4" /> : null}
    </video>
  );
}
