import {
  audioLoader,
  barsLoader,
  gridLoader,
  heartsLoader,
  threeDotsLoader,
} from '@/components/shared/loaders/classic-painters';
import {
  bubblesLoader,
  knifeChopLoader,
  panFlipLoader,
  pourDripLoader,
  riceFallLoader,
  steamLoader,
  whiskLoader,
} from '@/components/shared/loaders/kitchen-painters';
import type { LoaderSpec } from '@/components/shared/loaders/loader-math';
import {
  bounceLoader,
  dashLoader,
  ecgLoader,
  flipSquaresLoader,
  jellyLoader,
  ladderLoader,
  waveLoader,
} from '@/components/shared/loaders/motion-painters';

/**
 * The pool one meal draws from — one pick per analysis, held from the first
 * stage through the reveal (a loader that changes mid-run reads as a restart).
 *
 * Deliberately spinner-free. The five `classic` entries are the non-circular
 * survivors of the SamHerbert/SVG-Loaders set (MIT); the rest are this app's
 * own — kitchen for the ones that look like cooking, motion for the ones that
 * are just alive. The Flutter app draws the same nineteen from the same
 * geometry (`widgets/loaders/loader_registry.dart`).
 */
export const STREAM_LOADERS: LoaderSpec[] = [
  // classic
  audioLoader,
  barsLoader,
  gridLoader,
  heartsLoader,
  threeDotsLoader,
  // kitchen
  bubblesLoader,
  knifeChopLoader,
  panFlipLoader,
  pourDripLoader,
  riceFallLoader,
  steamLoader,
  whiskLoader,
  // motion
  bounceLoader,
  dashLoader,
  ecgLoader,
  flipSquaresLoader,
  jellyLoader,
  ladderLoader,
  waveLoader,
];

/** A random index into [STREAM_LOADERS]. */
export function pickLoaderIndex(): number {
  return Math.floor(Math.random() * STREAM_LOADERS.length);
}

/**
 * A stable index for a given key — the same meal draws the same loader on every
 * render, without anyone having to hold the pick in state.
 *
 * Used where the run already has an identity to hash (a streaming message id).
 * A loader that changes mid-run reads as a restart, so "stable" matters more
 * here than "random"; FNV-1a over the id spreads ids across the pool well
 * enough that consecutive meals rarely repeat.
 */
export function loaderIndexForKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % STREAM_LOADERS.length;
}

/**
 * The loader at `index`, wrapping out-of-range values rather than throwing —
 * the index is held across rerenders and must never crash the feed.
 */
export function loaderAt(index: number): LoaderSpec {
  const length = STREAM_LOADERS.length;
  return STREAM_LOADERS[((index % length) + length) % length];
}
