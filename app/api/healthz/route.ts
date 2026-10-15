import { type NextRequest, NextResponse } from 'next/server';

import { probeSharedDatabaseHealth } from '@/app/api/healthz/_lib/shared-db-health';
import { cardIndexStatus } from '@/lib/ai/matching/cards/search-index/search-index';
import { handleRouteError } from '@/lib/api/respond';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { getRequestIp } from '@/lib/infra/security/request-ip';

/**
 * Liveness probe. `{ ok, service, cardIndex }` and nothing else. `cardIndex`
 * is one status word for the in-container card search (`disabled`,
 * `loading`, `ready`, `failed`) — no build id, no counts — so the deploy's
 * smoke check can hold a revision whose search artifact did not load. It
 * never changes the status code: matching falls back to the database when the
 * artifact fails.
 *
 * The invariants behind `ok` are named in the server log, not in the body: the
 * old response told anonymous callers which tables exist, whether a trigger is
 * installed, how many food rows are seeded and how many auth users have no
 * profile. That is a schema map and a rough user count handed to anyone who
 * asks, in exchange for information no client of this endpoint reads — the
 * deploy gate greps `"ok":true`, the Flutter warm-up ping ignores the body
 * entirely, and an operator debugging a red deploy has the logs.
 *
 * `healthzIp` is a `memory` policy on purpose: this route must answer even
 * when the database is the thing that is broken, so its limiter cannot be
 * allowed to need one.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    if (ip) await assertRateLimit('healthzIp', { kind: 'ip', value: ip });
  } catch (error) {
    // A 429 answers in the standard error envelope, NOT as health JSON: a
    // throttled probe has learned nothing about the service, and reporting
    // `ok:false` would read as an outage.
    return handleRouteError(error);
  }

  try {
    const { ok, checks } = await probeSharedDatabaseHealth();

    if (ok) {
      console.info('[healthz] shared database invariants hold', checks);
    } else {
      console.error('[healthz] shared database invariants FAILED', checks);
    }

    return NextResponse.json(
      { ok, service: 'kallo', cardIndex: cardIndexStatus() },
      { status: ok ? 200 : 503 }
    );
  } catch (error) {
    console.error('Shared database health check failed.', error);

    return NextResponse.json(
      {
        ok: false,
        service: 'kallo',
        cardIndex: cardIndexStatus(),
        error: 'Shared database health check failed.',
      },
      { status: 503 }
    );
  }
}
