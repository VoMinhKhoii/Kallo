import { describe, expect, it, vi } from 'vitest';
import { createChatSessionStore } from '@/lib/ai/cache/chat-session';
import { createKeyPool, executeWithFailover } from '../provider';

describe('AI Key Rotation & Context Retention End-to-End (TC-4.1)', () => {
  it('retains multi-turn context when Key 1 hits 429 and rotates to Key 2', async () => {
    // 1. Initialize session memory store
    const sessionStore = createChatSessionStore();
    const sessionId = 'meal_chat_test_session';

    // 2. Initialize in-process key pool with 2 keys
    const pool = createKeyPool(['GEMINI_KEY_1', 'GEMINI_KEY_2'], {
      cooldownMs: 60_000,
    });

    const targetQuantity = '120g';
    const targetIngredient = 'thịt bắp bò';

    // Mock primary LLM execution engine
    const mockPrimaryCall = vi
      .fn()
      .mockImplementation(
        async (
          key: string,
          messages: Array<{ role: string; content: string }>
        ) => {
          const lastMsg = messages[messages.length - 1];

          // TURN 1: Key 1 succeeds normally
          if (lastMsg.content.includes('Tôi ăn trưa')) {
            expect(key).toBe('GEMINI_KEY_1');
            return `Đã ghi nhận bữa ăn: 1 bát Phở bò với 150g bánh phở và ${targetQuantity} ${targetIngredient}.`;
          }

          // TURN 2: Key 2 is acquired via round-robin, simulate 429 quota exhaustion
          if (key === 'GEMINI_KEY_2') {
            const quotaError = new Error(
              '429 Quota exceeded for quota metric "GenerateContentRequests" and limit "DefaultGroup"'
            );
            (quotaError as unknown as { status: number }).status = 429;
            throw quotaError;
          }

          // TURN 2: Key 1 receives failover call with FULL CONTEXT retained
          if (key === 'GEMINI_KEY_1') {
            // Assert that Key 1 received all prior conversational history
            expect(messages.length).toBeGreaterThanOrEqual(3);
            const historyText = messages.map((m) => m.content).join(' ');
            expect(historyText).toContain('Phở bò');
            expect(historyText).toContain(targetQuantity);
            expect(historyText).toContain(targetIngredient);

            // Key 1 responds recalling the exact details from Turn 1
            return `Trong bữa trưa Phở bò bạn vừa ghi nhận có ${targetQuantity} ${targetIngredient}.`;
          }

          throw new Error(`Unexpected key ${key}`);
        }
      );

    // ── TURN 1 ──────────────────────────────────────────────────────────────
    const prompt1 = `Tôi ăn trưa: 1 bát Phở bò với 150g bánh phở và ${targetQuantity} ${targetIngredient}.`;
    sessionStore.appendMessage(sessionId, { role: 'user', content: prompt1 });

    const reply1 = await executeWithFailover<string>({
      primaryPool: pool,
      messages: sessionStore.formatForGenericLlm(sessionStore.get(sessionId)!),
      executePrimary: mockPrimaryCall,
    });

    expect(reply1).toContain('Đã ghi nhận bữa ăn');
    sessionStore.appendMessage(sessionId, {
      role: 'assistant',
      content: reply1,
    });

    expect(pool.getSnapshot().activeKeys).toBe(2);
    expect(pool.getSnapshot().quarantinedKeys).toBe(0);

    // ── TURN 2 (Rotates mid-chat due to 429) ─────────────────────────────────
    const prompt2 = 'Trong bữa Phở bò tôi vừa ăn có bao nhiêu gam bắp bò?';
    sessionStore.appendMessage(sessionId, { role: 'user', content: prompt2 });

    const rotations: Array<{ fromKey: string; reason: string }> = [];

    const reply2 = await executeWithFailover<string>({
      primaryPool: pool,
      messages: sessionStore.formatForGenericLlm(sessionStore.get(sessionId)!),
      executePrimary: mockPrimaryCall,
      onRotation: (ev) => rotations.push(ev),
    });

    sessionStore.appendMessage(sessionId, {
      role: 'assistant',
      content: reply2,
    });

    // ── VERIFICATIONS ───────────────────────────────────────────────────────
    // 1. Turn 2 succeeded with context preserved
    expect(reply2).toContain(targetQuantity);
    expect(reply2).toContain(targetIngredient);

    // 2. Rotation occurred from Key 2
    expect(rotations).toHaveLength(1);
    expect(rotations[0].fromKey).toBe('GEMINI_KEY_2');
    expect(rotations[0].reason).toContain('429');

    // 3. Pool accurately records Key 1 as quarantined and Key 2 as active
    const snapshot = pool.getSnapshot();
    expect(snapshot.quarantinedKeys).toBe(1);
    expect(snapshot.activeKeys).toBe(1);

    // 4. Session history in store has all 4 messages intact
    const sessionFinal = sessionStore.get(sessionId)!;
    expect(sessionFinal.messages).toHaveLength(4);
    expect(sessionFinal.messages[0].content).toBe(prompt1);
    expect(sessionFinal.messages[1].content).toBe(reply1);
    expect(sessionFinal.messages[2].content).toBe(prompt2);
    expect(sessionFinal.messages[3].content).toBe(reply2);
  });
});
