import { describe, expect, it } from 'vitest';
import {
  ACTION_TOKEN_TTL_MS,
  signCloseDayToken,
  verifyCloseDayToken,
} from '@/lib/domain/reminders/action-token';

const SECRET = 'test-reminder-secret';
const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-11-04T14:00:00Z');

describe('close-day action token', () => {
  const token = signCloseDayToken(SECRET, {
    userId: USER,
    date: '2026-11-04',
    now: NOW,
  });

  it('round-trips the user and the day', () => {
    expect(verifyCloseDayToken(SECRET, token, NOW)).toEqual({
      userId: USER,
      date: '2026-11-04',
    });
  });

  it('refuses another secret', () => {
    expect(verifyCloseDayToken('other', token, NOW)).toBeNull();
  });

  it('refuses a token whose day or user was swapped', () => {
    const [, , expires, sig] = token.split('.');
    expect(
      verifyCloseDayToken(SECRET, `${USER}.2026-11-03.${expires}.${sig}`, NOW)
    ).toBeNull();
    const other = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    expect(
      verifyCloseDayToken(SECRET, `${other}.2026-11-04.${expires}.${sig}`, NOW)
    ).toBeNull();
  });

  it('expires', () => {
    const later = new Date(NOW.getTime() + ACTION_TOKEN_TTL_MS + 1000);
    expect(verifyCloseDayToken(SECRET, token, later)).toBeNull();
  });

  it('refuses junk without throwing', () => {
    for (const junk of ['', 'a.b.c.d', `${USER}.2026-11-04.x.y`, 'no-dots']) {
      expect(verifyCloseDayToken(SECRET, junk, NOW)).toBeNull();
    }
  });
});
