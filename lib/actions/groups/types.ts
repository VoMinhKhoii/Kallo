// ---------------------------------------------------------------------------
// Group tracking — profile / friendship / feed service functions
// ---------------------------------------------------------------------------
// Pure, dependency-light async functions. Each takes the authenticated actor's
// id plus an optional Drizzle `db` handle (defaulting to the app singleton) so
// the REST routes and tests can call them directly. NOTE: this Drizzle `db`
// connects via DATABASE_URL as the owner role and BYPASSES RLS, so the
// app-layer `WHERE actor = ...` scoping below is the PRIMARY authorization
// control here, not defense-in-depth — every query must carry an explicit actor
// predicate. RLS is the source of truth only for the Supabase-session/PostgREST
// path (direct client reads + the OG card route).

import type { db as defaultDb } from '@/lib/db';
import type { SharedMealEntry } from '@/lib/groups/meal-feed';

export type Db = typeof defaultDb;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface PublicProfile {
  userId: string;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
  /** Public URL of the uploaded avatar photo, or null (initials fallback). */
  avatarUrl: string | null;
}

export interface CircleMember {
  friendshipId: string;
  status: string;
  /** Direction of a pending request relative to the actor. */
  direction: 'incoming' | 'outgoing' | null;
  profile: PublicProfile;
}

export type CircleFeedEntry = SharedMealEntry;

/** One page of the combined Friends thread (seek-paginated oldest-ward). */
export interface FriendsThreadFeedPage {
  entries: CircleFeedEntry[];
  nextCursor: string | null;
}

/** Hard cap on the ambient wall: top friends, last 24h, non-scrollable. */
export const CIRCLE_FEED_FRIEND_CAP = 20;
