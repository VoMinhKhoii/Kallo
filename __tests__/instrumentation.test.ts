import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `register` must finish before the server takes requests, so it warms the
 * card catalog without waiting for it: a cold container's first page load
 * should not sit behind a ~3 s catalog read. It loads no nutrition: card
 * matching fetches a meal's candidates by id.
 */

const db = { tag: 'db' };
const getNutritionCache = vi.fn(async () => ({}));
const getCardCatalog = vi.fn(() => new Promise(() => {}));

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
}));
vi.mock('@/lib/infra/db/client', () => ({ db }));
vi.mock('@/lib/ai/cache/nutrition-cache', () => ({ getNutritionCache }));
vi.mock('@/lib/ai/matching/cards/catalog', () => ({ getCardCatalog }));

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('register', () => {
  it('starts the card catalog load on the Node runtime without waiting for it', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const { register } = await import('@/instrumentation');

    // getCardCatalog never resolves here; register still finishes.
    await register();

    expect(getCardCatalog).toHaveBeenCalledWith(db);
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
