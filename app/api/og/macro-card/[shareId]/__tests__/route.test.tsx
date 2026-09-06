/**
 * Characterization tests for the macro-card OG route.
 *
 * The card is rendered by Satori inside `ImageResponse`, which we cannot run
 * cheaply here — so `@vercel/og` is mocked and the React element handed to it
 * is rendered to static markup instead. That markup is the contract: it pins
 * every literal hex token, the ring geometry, the seeded swatch and the
 * font-size branch, so an extraction that changes one pixel fails loudly.
 */
import { getTableName } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisGuardEvents } from '@/lib/infra/db/schema';

class MockImageResponse {
  static calls: { element: React.ReactElement; options: MockOptions }[] = [];
  constructor(element: React.ReactElement, options: MockOptions) {
    MockImageResponse.calls.push({ element, options });
  }
}

interface MockOptions {
  width: number;
  height: number;
  fonts: { name: string; data: ArrayBuffer; weight: number; style: string }[];
  headers: Record<string, string>;
}

vi.mock('@vercel/og', () => ({ ImageResponse: MockImageResponse }));

const mockGetUser = vi.fn();
const mockCheckAnalysisGuards = vi.fn();
const mockBuildAnalysisGuardEvent = vi.fn((input: unknown) => ({
  built: input,
}));
const mockDbInsert = vi.fn();
const mockDbInsertValues = vi.fn();

/** table name -> the rows that table's SELECT resolves to */
const tableRows = new Map<string, unknown[]>();
const selectedTables: string[] = [];
/** What `canViewShareOwnedBy`'s friendship/group probe resolves to. */
let relationshipVisible = false;

vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

/**
 * A Drizzle select stub good enough for the three table reads. The
 * relationship probe inside `canViewShareOwnedBy` is a raw `db.execute`
 * statement, stubbed separately below.
 */
function selectStub() {
  let source: unknown;
  const query = {
    from(src: unknown) {
      source = src;
      return query;
    },
    where() {
      return query;
    },
    limit() {
      const table = getTableName(source as Parameters<typeof getTableName>[0]);
      selectedTables.push(table);
      return Promise.resolve(tableRows.get(table) ?? []);
    },
  };
  return query;
}

vi.mock('@/lib/infra/rate-limit/analysis-guards', () => ({
  buildAnalysisGuardEvent: (input: unknown) =>
    mockBuildAnalysisGuardEvent(input),
  checkAnalysisGuards: (...args: unknown[]) => mockCheckAnalysisGuards(...args),
}));

vi.mock('@/lib/infra/db/client', () => {
  const chain = {
    select: () => selectStub(),
    execute: () => Promise.resolve([{ visible: relationshipVisible }]),
    insert: (table?: unknown) => {
      mockDbInsert(table);
      return chain;
    },
    values: (values?: unknown) => {
      mockDbInsertValues(values);
      return Promise.resolve();
    },
  };
  return { db: chain };
});

const { GET } = await import('@/app/api/og/macro-card/[shareId]/route');

const SHARE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function request(headers: Record<string, string> = {}): NextRequest {
  return new Request(`http://localhost/api/og/macro-card/${SHARE_ID}`, {
    headers,
  }) as unknown as NextRequest;
}

function call(shareId = SHARE_ID, headers: Record<string, string> = {}) {
  return GET(request(headers), { params: Promise.resolve({ shareId }) });
}

/** The markup Satori would have been handed. */
function renderedCard(index = 0): string {
  const entry = MockImageResponse.calls[index];
  if (!entry) throw new Error('ImageResponse was never constructed');
  return renderToStaticMarkup(entry.element);
}

const MEAL = {
  rawInput: 'Phở bò tái',
  caloriesKcal: 512.4,
  proteinG: 28.6,
  carbohydrateG: 61.2,
  fatG: 14.9,
  userId: 'viewer-1',
};

/** The default share is the viewer's own — authorized without a probe. */
const OWN_SHARE = {
  mealId: 'meal-1',
  actorId: 'viewer-1',
  sharedAt: new Date('2026-08-01T00:00:00Z'),
  visibility: 'circle',
};

beforeEach(() => {
  MockImageResponse.calls = [];
  selectedTables.length = 0;
  relationshipVisible = false;
  tableRows.clear();
  tableRows.set('meal_shares', [OWN_SHARE]);
  tableRows.set('meals', [MEAL]);
  tableRows.set('public_profiles', [{ avatarSeed: 'seed-alpha' }]);

  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'viewer-1' } } });
  mockCheckAnalysisGuards.mockReset();
  mockCheckAnalysisGuards.mockResolvedValue({ allowed: true });
  mockBuildAnalysisGuardEvent.mockClear();
  mockDbInsert.mockClear();
  mockDbInsertValues.mockClear();
});

describe('GET /api/og/macro-card/[shareId]', () => {
  it('404s a malformed shareId before touching Supabase', async () => {
    const res = await call('not-a-uuid');

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
    expect(json.error.message).toBe('Macro card not found.');
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('accepts any 36-char hex-and-dash id (the regex is not a UUID check)', async () => {
    // Characterizes the CURRENT loose validation, not an ideal one.
    const res = await call('----------------------------------aa');
    expect(res.status).not.toBe(404);
  });

  it('401s an unauthenticated viewer', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await call();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_AUTHENTICATED');
    expect(mockCheckAnalysisGuards).not.toHaveBeenCalled();
  });

  it('401s when Supabase reports an auth error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'viewer-1' } },
      error: new Error('bad jwt'),
    });

    const res = await call();
    expect(res.status).toBe(401);
  });

  it('applies the OG-specific rate-limit window keyed on the viewer', async () => {
    await call(SHARE_ID, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' });

    expect(mockCheckAnalysisGuards).toHaveBeenCalledWith({
      userId: 'viewer-1',
      ip: '203.0.113.9',
      route: '/api/og/macro-card',
      limits: {
        perUserMinute: 10,
        perUserHour: 60,
        perUserDay: 200,
        concurrentUser: Number.MAX_SAFE_INTEGER,
      },
    });
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    await call(SHARE_ID, { 'x-real-ip': '198.51.100.4' });

    expect(mockCheckAnalysisGuards.mock.calls[0]?.[0]).toMatchObject({
      ip: '198.51.100.4',
    });
  });

  it('reports a null ip when neither proxy header is present', async () => {
    await call();

    expect(mockCheckAnalysisGuards.mock.calls[0]?.[0]).toMatchObject({
      ip: null,
    });
  });

  it('429s with Retry-After and logs a guard event when throttled', async () => {
    mockCheckAnalysisGuards.mockResolvedValue({
      allowed: false,
      reason: 'per_user_minute',
      retryAfterSeconds: 42,
    });

    const res = await call(SHARE_ID, { 'x-real-ip': '198.51.100.4' });

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMITED');

    expect(mockDbInsert).toHaveBeenCalledWith(analysisGuardEvents);
    expect(mockBuildAnalysisGuardEvent).toHaveBeenCalledWith({
      userId: 'viewer-1',
      ip: '198.51.100.4',
      route: '/api/og/macro-card',
      reason: 'per_user_minute',
      retryAfterSeconds: 42,
    });
    expect(MockImageResponse.calls).toHaveLength(0);
  });

  it('still 429s when the guard-event insert throws', async () => {
    mockCheckAnalysisGuards.mockResolvedValue({
      allowed: false,
      reason: 'per_user_hour',
      retryAfterSeconds: 7,
    });
    mockDbInsertValues.mockImplementationOnce(() => {
      throw new Error('telemetry down');
    });

    const res = await call();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7');
  });

  it('renders the card for the share owner', async () => {
    const res = await call();

    expect(res).toBeInstanceOf(MockImageResponse);
    expect(MockImageResponse.calls).toHaveLength(1);
  });

  it('404s a viewer with no relationship to the sharer', async () => {
    // Drizzle bypasses RLS, so this is the check that has to hold.
    tableRows.set('meal_shares', [{ ...OWN_SHARE, actorId: 'someone-else' }]);
    relationshipVisible = false;

    const res = await call();

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toBe('Macro card not found.');
    expect(MockImageResponse.calls).toHaveLength(0);
  });

  it('renders for a viewer the share visibility gate allows', async () => {
    tableRows.set('meal_shares', [{ ...OWN_SHARE, actorId: 'someone-else' }]);
    relationshipVisible = true;

    const res = await call();
    expect(res).toBeInstanceOf(MockImageResponse);
  });

  it('404s a shareId that does not exist, exactly like a denied one', async () => {
    tableRows.set('meal_shares', []);

    const res = await call();

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toBe('Macro card not found.');
  });

  it('404s when the meal row is missing', async () => {
    tableRows.set('meals', []);

    const res = await call();
    expect(res.status).toBe(404);
  });

  it('reads share, meal and profile through Drizzle', async () => {
    await call();

    expect(selectedTables).toEqual(['meal_shares', 'meals', 'public_profiles']);
  });

  it('renders at 1080x1920 with both vendored fonts and a private cache header', async () => {
    await call();

    const { options } = MockImageResponse.calls[0];
    expect(options.width).toBe(1080);
    expect(options.height).toBe(1920);
    expect(options.headers['Cache-Control']).toBe(
      'private, max-age=86400, stale-while-revalidate=604800, immutable'
    );
    expect(
      options.fonts.map((f) => [f.name, f.weight, f.style, f.data.byteLength])
    ).toEqual([
      ['Lora', 400, 'normal', 132188],
      ['DM Sans', 700, 'normal', 48200],
    ]);
  });

  it('caches the font read across requests', async () => {
    await call();
    await call();

    const first = MockImageResponse.calls[0].options.fonts[0].data;
    const second = MockImageResponse.calls[1].options.fonts[0].data;
    expect(second).toBe(first);
  });

  it('renders the full card exactly', async () => {
    await call();
    expect(renderedCard()).toMatchSnapshot();
  });

  it('renders em-dashes and N/A when the meal has no numbers', async () => {
    tableRows.set('meals', [
      {
        rawInput: '   ',
        caloriesKcal: null,
        proteinG: null,
        carbohydrateG: null,
        fatG: null,
        userId: 'viewer-1',
      },
    ]);
    tableRows.set('public_profiles', []);

    await call();
    expect(renderedCard()).toMatchSnapshot();
  });

  it('drops the dish font size from 110 to 84 past 40 characters', async () => {
    tableRows.set('meals', [{ ...MEAL, rawInput: 'x'.repeat(40) }]);
    await call();
    expect(renderedCard(0)).toContain('font-size:110px');

    tableRows.set('meals', [{ ...MEAL, rawInput: 'y'.repeat(41) }]);
    await call();
    expect(renderedCard(1)).toContain('font-size:84px');
  });

  it('derives a stable warm swatch from avatar_seed', async () => {
    const swatchOf = (markup: string) =>
      /background-color:(hsl\([^)]*\))/.exec(markup)?.[1];

    await call();
    const a = swatchOf(renderedCard(0));

    tableRows.set('public_profiles', [{ avatarSeed: 'seed-beta' }]);
    await call();
    const b = swatchOf(renderedCard(1));

    tableRows.set('public_profiles', [{ avatarSeed: 'seed-alpha' }]);
    await call();
    const c = swatchOf(renderedCard(2));

    expect(a).toBe('hsl(30, 46%, 58%)');
    expect(b).toBe('hsl(24, 46%, 58%)');
    expect(c).toBe(a);
  });

  it('falls back to the "nham" seed when the profile has none', async () => {
    tableRows.set('public_profiles', [{ avatarSeed: null }]);
    await call();
    const seeded = renderedCard(0);

    tableRows.set('public_profiles', [{ avatarSeed: '' }]);
    await call();
    expect(renderedCard(1)).toBe(seeded);
  });

  it('scales macro bars against the largest macro in the meal, not a percentage', async () => {
    tableRows.set('meals', [
      { ...MEAL, proteinG: 25, carbohydrateG: 100, fatG: 0 },
    ]);

    await call();
    const markup = renderedCard();
    expect(markup).toContain('width:25%');
    expect(markup).toContain('width:100%');
    expect(markup).toContain('width:0%');
    expect(markup).toContain('P: 25g');
    expect(markup).toContain('C: 100g');
    expect(markup).toContain('F: 0g');
  });

  it('keeps a zero-macro meal from dividing by zero', async () => {
    tableRows.set('meals', [
      { ...MEAL, proteinG: 0, carbohydrateG: 0, fatG: 0 },
    ]);

    await call();
    const markup = renderedCard();
    expect(markup).not.toContain('NaN');
    expect(markup.match(/width:0%/g)).toHaveLength(3);
  });

  it('coerces numeric strings from the driver', async () => {
    tableRows.set('meals', [
      {
        ...MEAL,
        caloriesKcal: '1234.6',
        proteinG: '10.4',
        carbohydrateG: 'not-a-number',
        fatG: Number.NaN,
      },
    ]);

    await call();
    const markup = renderedCard();
    expect(markup).toContain('1,235');
    expect(markup).toContain('P: 10g');
    expect(markup).toContain('C: N/A');
    expect(markup).toContain('F: N/A');
  });

  it('500s when the card render throws', async () => {
    const spy = vi
      .spyOn(MockImageResponse, 'calls', 'get')
      .mockImplementation(() => {
        throw new Error('satori blew up');
      });

    const res = await call();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('INTERNAL');

    spy.mockRestore();
  });
});
