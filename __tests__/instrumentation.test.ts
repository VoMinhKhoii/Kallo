import { inspect } from 'node:util';
import * as Sentry from '@sentry/nextjs';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `register` must finish before the server takes requests, so it warms the
 * card catalog without waiting for it: a cold container's first page load
 * should not sit behind a ~3 s catalog read. It loads no nutrition: card
 * matching fetches a meal's candidates by id.
 */

const db = { tag: 'db' };
// Never resolves: register must not wait on the pool warm-up either.
const warmDbPool = vi.fn(() => new Promise<void>(() => {}));
const preloadSigningKeys = vi.fn(async () => {});
const getNutritionCache = vi.fn(async () => ({}));
const getCardCatalog = vi.fn(() => new Promise(() => {}));
const cardIndexConfigured = vi.fn(() => false);

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
}));
vi.mock('@/lib/infra/db/client', () => ({ db, warmDbPool }));
vi.mock('@/lib/infra/telemetry/monitoring/gc-pauses', () => ({
  watchGcPauses: vi.fn(),
}));
vi.mock('@/lib/infra/auth/signing-keys/signing-keys', () => ({
  preloadSigningKeys,
}));
vi.mock('@/lib/ai/cache/nutrition-cache', () => ({ getNutritionCache }));
vi.mock('@/lib/ai/matching/cards/catalog', () => ({ getCardCatalog }));
vi.mock('@/lib/ai/matching/cards/search-index/search-index', () => ({
  cardIndexConfigured,
}));

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('register', () => {
  it('scrubs query params and driver details before captureRequestError', async () => {
    const { onRequestError } = await import('@/instrumentation');
    const error = new DrizzleQueryError(
      'select $1',
      ['private value'],
      Object.assign(new Error('bad private value'), { code: '22P02' })
    );
    const request = { path: '/api/test', method: 'POST', headers: {} };
    const context = {
      routerKind: 'App Router',
      routePath: '/api/test',
      routeType: 'route',
    } as const;
    await onRequestError(error, request, context);
    expect(Sentry.captureRequestError).toHaveBeenCalledWith(
      expect.any(Error),
      request,
      context
    );
    expect(
      inspect(vi.mocked(Sentry.captureRequestError).mock.calls)
    ).not.toContain('private value');
    expect(inspect(vi.mocked(Sentry.captureRequestError).mock.calls)).toContain(
      '22P02'
    );
  });
  it('starts the card catalog load on the Node runtime without waiting for it', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const { register } = await import('@/instrumentation');

    // getCardCatalog never resolves here; register still finishes.
    await register();

    expect(getCardCatalog).toHaveBeenCalledWith(db);
  });

  it('opens the database pool and loads the signing keys at boot without waiting', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@h:6543/db');
    const { register } = await import('@/instrumentation');

    // warmDbPool never resolves here; register still finishes.
    await register();

    expect(warmDbPool).toHaveBeenCalledTimes(1);
    expect(preloadSigningKeys).toHaveBeenCalledTimes(1);
  });

  it('does not warm a pool with no database configured', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('DATABASE_URL', '');
    const { register } = await import('@/instrumentation');

    await register();

    expect(warmDbPool).not.toHaveBeenCalled();
  });

  it('loads the search artifact instead of the database catalog when one is pinned', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    cardIndexConfigured.mockReturnValueOnce(true);
    const { register } = await import('@/instrumentation');

    await register();

    expect(cardIndexConfigured).toHaveBeenCalled();
    expect(getCardCatalog).not.toHaveBeenCalled();
  });

  it('does not load the nutrition cache', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const { register } = await import('@/instrumentation');

    await register();

    expect(getNutritionCache).not.toHaveBeenCalled();
  });

  it('warms nothing on the Edge runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    const { register } = await import('@/instrumentation');

    await register();

    expect(getCardCatalog).not.toHaveBeenCalled();
    expect(getNutritionCache).not.toHaveBeenCalled();
  });
});
