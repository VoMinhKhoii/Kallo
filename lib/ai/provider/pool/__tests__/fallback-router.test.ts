import { describe, expect, it, vi } from 'vitest';
import type { GenericLlmMessage } from '@/lib/ai/cache/chat-session';
import { executeWithFailover, KeyPoolExhaustedError } from '../fallback-router';
import { createKeyPool } from '../key-pool';

describe('executeWithFailover', () => {
  const sampleMessages: GenericLlmMessage[] = [
    { role: 'user', content: 'Turn 1: Phở bò 150g bánh phở' },
    { role: 'assistant', content: 'Turn 1 Ack: Đã ghi nhận phở bò' },
    { role: 'user', content: 'Turn 2: Thêm 50g hành tây' },
  ];

  it('TC-3.1: prefers primary pool when healthy and does not invoke fallback', async () => {
    const pool = createKeyPool(['KEY_A', 'KEY_B']);
    const mockPrimary = vi.fn().mockResolvedValue('primary_response');
    const mockFallback = vi.fn().mockResolvedValue('fallback_response');

    const result = await executeWithFailover({
      primaryPool: pool,
      messages: sampleMessages,
      executePrimary: mockPrimary,
      executeFallback: mockFallback,
    });

    expect(result).toBe('primary_response');
    expect(mockPrimary).toHaveBeenCalledTimes(1);
    expect(mockPrimary).toHaveBeenCalledWith('KEY_A', sampleMessages);
    expect(mockFallback).not.toHaveBeenCalled();
  });

  it('TC-3.2: fails over to Key B when Key A throws 429, preserving messages array', async () => {
    const pool = createKeyPool(['KEY_A', 'KEY_B']);
    const mockPrimary = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED'))
      .mockResolvedValueOnce('key_b_response');

    const rotations: Array<{ fromKey: string; reason: string }> = [];

    const result = await executeWithFailover({
      primaryPool: pool,
      messages: sampleMessages,
      executePrimary: mockPrimary,
      onRotation: (e) => rotations.push(e),
    });

    expect(result).toBe('key_b_response');
    expect(mockPrimary).toHaveBeenCalledTimes(2);
    expect(mockPrimary).toHaveBeenNthCalledWith(1, 'KEY_A', sampleMessages);
    expect(mockPrimary).toHaveBeenNthCalledWith(2, 'KEY_B', sampleMessages);

    expect(rotations).toHaveLength(1);
    expect(rotations[0].fromKey).toBe('KEY_A');
    expect(rotations[0].reason).toContain('429');

    // Key A is now quarantined
    expect(pool.getSnapshot().quarantinedKeys).toBe(1);
  });

  it('TC-3.3: triggers Tier-2 fallback with full context when all primary keys are exhausted', async () => {
    const pool = createKeyPool(['KEY_A', 'KEY_B']);
    const mockPrimary = vi
      .fn()
      .mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));
    const mockFallback = vi.fn().mockResolvedValue('claude_fallback_response');

    const result = await executeWithFailover({
      primaryPool: pool,
      messages: sampleMessages,
      executePrimary: mockPrimary,
      executeFallback: mockFallback,
      fallbackProvider: 'claude',
    });

    expect(result).toBe('claude_fallback_response');
    expect(mockPrimary).toHaveBeenCalledTimes(2); // Key A, then Key B
    expect(mockFallback).toHaveBeenCalledTimes(1);
    expect(mockFallback).toHaveBeenCalledWith('claude', sampleMessages);
  });

  it('throws KeyPoolExhaustedError if all keys are exhausted and no fallback is configured', async () => {
    const pool = createKeyPool(['KEY_A']);
    const mockPrimary = vi
      .fn()
      .mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));

    await expect(
      executeWithFailover({
        primaryPool: pool,
        messages: sampleMessages,
        executePrimary: mockPrimary,
      })
    ).rejects.toThrow(KeyPoolExhaustedError);
  });

  it('EC-4: does not quarantine keys on non-quota errors (e.g. 400 Bad Request)', async () => {
    const pool = createKeyPool(['KEY_A', 'KEY_B']);
    const mockPrimary = vi
      .fn()
      .mockRejectedValue(new Error('400 Invalid JSON schema'));

    await expect(
      executeWithFailover({
        primaryPool: pool,
        messages: sampleMessages,
        executePrimary: mockPrimary,
      })
    ).rejects.toThrow('400 Invalid JSON schema');

    // Key A was NOT quarantined
    expect(pool.getSnapshot().quarantinedKeys).toBe(0);
    expect(pool.getSnapshot().activeKeys).toBe(2);
  });

  it('permanently revokes keys on 401/403 and immediately tries next key', async () => {
    const pool = createKeyPool(['KEY_LEAKED', 'KEY_VALID']);
    const mockPrimary = vi
      .fn()
      .mockRejectedValueOnce(new Error('403 API_KEY_INVALID'))
      .mockResolvedValueOnce('valid_key_response');

    const result = await executeWithFailover({
      primaryPool: pool,
      messages: sampleMessages,
      executePrimary: mockPrimary,
    });

    expect(result).toBe('valid_key_response');
    expect(pool.getSnapshot().revokedKeys).toBe(1);
    expect(pool.getSnapshot().activeKeys).toBe(1);
  });

  it('EC-5: respects AbortSignal during failover loop', async () => {
    const pool = createKeyPool(['KEY_A', 'KEY_B']);
    const controller = new AbortController();

    const mockPrimary = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error('429 RESOURCE_EXHAUSTED');
    });

    await expect(
      executeWithFailover({
        primaryPool: pool,
        messages: sampleMessages,
        executePrimary: mockPrimary,
        abortSignal: controller.signal,
      })
    ).rejects.toThrow(/aborted/i);

    // Key B was never invoked because abort halted execution
    expect(mockPrimary).toHaveBeenCalledTimes(1);
  });
});
