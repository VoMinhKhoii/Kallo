'use client';

import {
  SurfaceState,
  type SurfaceStateProps,
} from '@/components/shared/surface-state/surface-state';
import { SYSTEM_CAST } from '@/lib/brand/illustrations/casts/system';

/**
 * `SurfaceState` with the system cast, for Server Components (the 404 page).
 * The cast is imported here, in client code, so it ships once in the client
 * bundle; passed as a prop from the server it would be serialized into the RSC
 * payload of every page the 404 boundary ships with (~20 KB of pen strokes).
 */
export function SystemSurfaceState(props: Omit<SurfaceStateProps, 'cast'>) {
  return <SurfaceState {...props} cast={SYSTEM_CAST} />;
}
