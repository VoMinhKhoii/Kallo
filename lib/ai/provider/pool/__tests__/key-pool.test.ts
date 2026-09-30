import { beforeEach, describe, expect, it } from 'vitest';
import { createKeyPool, parseKeyList } from '../key-pool';

describe('KeyPool & parseKeyList', () => {
  let currentTime = 1_000_000;

  beforeEach(() => {
    currentTime = 1_000_000;
  });

  describe('parseKeyList (EC-3)', () => {
    it('sanitizes messy comma-separated string inputs', () => {
      const parsed = parseKeyList(' AIzaKey1, , AIzaKey2 , AIzaKey3, ');
      expect(parsed).toEqual(['AIzaKey1', 'AIzaKey2', 'AIzaKey3']);
    });

    it('deduplicates identical keys and trims whitespace', () => {
      const parsed = parseKeyList(['key1 ', ' key2', 'key1']);
      expect(parsed).toEqual(['key1', 'key2']);
    });

    it('returns empty array on undefined or null input', () => {
      expect(parseKeyList(undefined)).toEqual([]);
      expect(parseKeyList(null)).toEqual([]);
      expect(parseKeyList('')).toEqual([]);
    });
  });

  describe('KeyPool operations', () => {
    it('TC-2.1: distributes healthy traffic via even round-robin sequence', () => {
      const pool = createKeyPool(['KEY_A', 'KEY_B', 'KEY_C'], {
        now: () => currentTime,
      });

      const sequence = [];
      for (let i = 0; i < 6; i++) {
        sequence.push(pool.acquireKey()?.key);
      }

      expect(sequence).toEqual([
        'KEY_A',
        'KEY_B',
        'KEY_C',
        'KEY_A',
        'KEY_B',
        'KEY_C',
      ]);
    });

    it('TC-2.2: immediately quarantines 429 keys and switches to next key with 0ms wait', () => {
      const pool = createKeyPool(['KEY_A', 'KEY_B'], {
        cooldownMs: 60_000,
        now: () => currentTime,
      });

      const first = pool.acquireKey();
      expect(first?.key).toBe('KEY_A');

      // Key A hits 429
      pool.markQuarantine('KEY_A', '429 Quota Exceeded');

      // Immediate subsequent call must return KEY_B with zero delay
      const second = pool.acquireKey();
      expect(second?.key).toBe('KEY_B');

      // And third call continues using KEY_B while KEY_A is quarantined
      const third = pool.acquireKey();
      expect(third?.key).toBe('KEY_B');

      const snapshot = pool.getSnapshot();
      expect(snapshot.activeKeys).toBe(1);
      expect(snapshot.quarantinedKeys).toBe(1);
    });

    it('TC-2.3: automatically recovers quarantined keys after 60-second cooldown expires', () => {
      const pool = createKeyPool(['KEY_A', 'KEY_B'], {
        cooldownMs: 60_000,
        now: () => currentTime,
      });

      pool.markQuarantine('KEY_A');
      expect(pool.acquireKey()?.key).toBe('KEY_B');

      // At t = 30s: KEY_A is still in cooldown
      currentTime += 30_000;
      expect(pool.acquireKey()?.key).toBe('KEY_B');

      // At t = 61s: KEY_A cooldown has elapsed
      currentTime += 31_000;
      const recovered = pool.acquireKey();
      expect(recovered?.key).toBe('KEY_A');

      const snapshot = pool.getSnapshot();
      expect(snapshot.activeKeys).toBe(2);
      expect(snapshot.quarantinedKeys).toBe(0);
    });

    it('TC-2.4: permanently revokes invalid credentials (401/403) and never re-attempts them', () => {
      const pool = createKeyPool(['KEY_BAD', 'KEY_GOOD'], {
        now: () => currentTime,
      });

      pool.markRevoked('KEY_BAD', '403 API_KEY_INVALID');

      // Even after 10 hours, KEY_BAD must never be returned
      currentTime += 10 * 60 * 60 * 1000;

      for (let i = 0; i < 5; i++) {
        expect(pool.acquireKey()?.key).toBe('KEY_GOOD');
      }

      const snapshot = pool.getSnapshot();
      expect(snapshot.activeKeys).toBe(1);
      expect(snapshot.revokedKeys).toBe(1);
      expect(snapshot.quarantinedKeys).toBe(0);
    });

    it('TC-2.5: signals pool exhaustion and calculates nextAvailableInMs when all keys are cooling', () => {
      const pool = createKeyPool(['KEY_1', 'KEY_2'], {
        cooldownMs: 60_000,
        now: () => currentTime,
      });

      pool.markQuarantine('KEY_1', '429', 40_000);
      currentTime += 10_000;
      pool.markQuarantine('KEY_2', '429', 50_000);

      // Both keys are now quarantined
      const acquired = pool.acquireKey();
      expect(acquired).toBeNull();

      const snapshot = pool.getSnapshot();
      expect(snapshot.activeKeys).toBe(0);
      expect(snapshot.quarantinedKeys).toBe(2);
      // Key 1 expires at 1_040_000, currentTime is 1_010_000 -> 30_000 ms remaining
      expect(snapshot.nextAvailableInMs).toBe(30_000);
    });

    it('EC-2: handles single-key pool gracefully when quarantined', () => {
      const pool = createKeyPool('SINGLE_KEY', {
        cooldownMs: 60_000,
        now: () => currentTime,
      });

      expect(pool.size()).toBe(1);
      expect(pool.acquireKey()?.key).toBe('SINGLE_KEY');

      pool.markQuarantine('SINGLE_KEY');
      expect(pool.acquireKey()).toBeNull();

      // Recovers after cooldown
      currentTime += 61_000;
      expect(pool.acquireKey()?.key).toBe('SINGLE_KEY');
    });

    it('markSuccess clears quarantine status if a key recovers', () => {
      const pool = createKeyPool(['K1', 'K2'], { now: () => currentTime });
      pool.markQuarantine('K1');
      pool.markSuccess('K1');

      const snapshot = pool.getSnapshot();
      expect(snapshot.activeKeys).toBe(2);
      expect(snapshot.quarantinedKeys).toBe(0);
    });
  });
});
