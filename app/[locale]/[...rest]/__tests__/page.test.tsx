import { describe, expect, it } from 'vitest';
import CatchAllNotFound from '../page';

// The regression this closes: without this catch-all, `/en/anything` never
// entered `[locale]` and fell through to Next's own default 404, so the
// branded `app/[locale]/not-found.tsx` never showed for an unmatched path.

describe('the locale catch-all', () => {
  it('renders nothing itself — it hands the request to not-found', () => {
    expect(() => CatchAllNotFound()).toThrow();
  });

  it('throws Next’s not-found signal, not an ordinary error', () => {
    // Next marks the control-flow throw with a digest the router reads to
    // pick `not-found.tsx` over the error boundary. The spelling moved from
    // `NEXT_NOT_FOUND` to `NEXT_HTTP_ERROR_FALLBACK;404`, so accept either.
    let digest: unknown;
    try {
      CatchAllNotFound();
    } catch (error) {
      digest = (error as { digest?: unknown }).digest;
    }

    expect(String(digest)).toMatch(
      /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404/
    );
  });
});
