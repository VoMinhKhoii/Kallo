import { beforeEach, describe, expect, it, vi } from 'vitest';

const connection = vi.fn(async () => {});
vi.mock('next/server', () => ({ connection: () => connection() }));
const cardIndexSettled = vi.fn();
vi.mock('@/lib/ai/matching/cards/search-index/search-index', () => ({
  cardIndexSettled: () => cardIndexSettled(),
}));

const { GET } = await import('../route');

beforeEach(() => vi.clearAllMocks());

describe('GET /api/startupz', () => {
  it('answers 503 while the container is still loading its build', async () => {
    cardIndexSettled.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('');
  });

  it('answers 200 once the container may take traffic', async () => {
    cardIndexSettled.mockReturnValue(true);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('reads the state at request time, never at build time', async () => {
    let order = '';
    connection.mockImplementationOnce(async () => {
      order += 'connection;';
    });
    cardIndexSettled.mockImplementationOnce(() => {
      order += 'settled;';
      return true;
    });
    await GET();
    expect(order).toBe('connection;settled;');
  });
});
