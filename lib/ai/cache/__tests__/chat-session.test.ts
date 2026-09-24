import { beforeEach, describe, expect, it } from 'vitest';
import {
  type ChatSessionStore,
  createChatSessionStore,
} from '@/lib/ai/cache/chat-session';

describe('ChatSessionStore', () => {
  let currentTime = 1_000_000;
  let store: ChatSessionStore;

  beforeEach(() => {
    currentTime = 1_000_000;
    store = createChatSessionStore({
      maxEntries: 10,
      ttlMs: 30 * 60 * 1000, // 30 minutes
      maxTurns: 5,
      now: () => currentTime,
    });
  });

  it('TC-1.1: preserves message lifecycle and exact chronological order', () => {
    store.appendMessage('sess_01', {
      role: 'user',
      content: '1 bowl of pho bo with 150g noodles and 120g beef',
    });
    currentTime += 1000;

    store.appendMessage('sess_01', {
      role: 'assistant',
      content: 'Logged 1 bowl of Pho Bo (150g rice noodles, 120g beef)',
    });
    currentTime += 1000;

    store.appendMessage('sess_01', {
      role: 'user',
      content: 'How much protein was in that?',
    });

    const session = store.get('sess_01');
    expect(session).not.toBeNull();
    expect(session?.messages).toHaveLength(3);
    expect(session?.messages[0].role).toBe('user');
    expect(session?.messages[0].content).toContain('pho bo');
    expect(session?.messages[1].role).toBe('assistant');
    expect(session?.messages[2].role).toBe('user');
    expect(session?.messages[2].content).toContain('protein');
    expect(session?.lastActiveAt).toBe(1_002_000);
  });

  it('TC-1.2: formats normalized messages for Gemini prompt with system instructions', () => {
    store.appendMessage('sess_prompt', {
      role: 'system',
      content: 'You are Kallo nutritional assistant. Always output grams.',
    });
    store.appendMessage('sess_prompt', {
      role: 'user',
      content: 'Bún chả Hà Nội 1 suất',
    });
    store.appendMessage('sess_prompt', {
      role: 'assistant',
      content: 'Bún chả gồm 200g bún, 100g thịt nướng, 50g chả nướng.',
    });

    const session = store.get('sess_prompt')!;
    const formatted = store.formatForGemini(session);

    expect(formatted.systemInstruction).toBe(
      'You are Kallo nutritional assistant. Always output grams.'
    );
    expect(formatted.contents).toHaveLength(2);
    expect(formatted.contents[0].role).toBe('user');
    expect(formatted.contents[0].parts[0].text).toBe('Bún chả Hà Nội 1 suất');
    expect(formatted.contents[1].role).toBe('model');
    expect(formatted.contents[1].parts[0].text).toContain(
      'Bún chả gồm 200g bún'
    );
  });

  it('TC-1.2b: formats normalized messages for generic LLM endpoints', () => {
    store.appendMessage('sess_gen', {
      role: 'system',
      content: 'System instruction',
    });
    store.appendMessage('sess_gen', {
      role: 'user',
      content: 'User query',
    });
    store.appendMessage('sess_gen', {
      role: 'assistant',
      content: 'Assistant answer',
    });

    const session = store.get('sess_gen')!;
    const formatted = store.formatForGenericLlm(session);

    expect(formatted).toEqual([
      { role: 'system', content: 'System instruction' },
      { role: 'user', content: 'User query' },
      { role: 'assistant', content: 'Assistant answer' },
    ]);
  });

  it('TC-1.3: enforces sliding window trimming on conversational turns while preserving system message', () => {
    // maxTurns is 5, so conversational turns max at 10 messages (5 user + 5 assistant)
    store.appendMessage('sess_trim', {
      role: 'system',
      content: 'System rule',
    });

    // Append 8 user-assistant pairs (16 messages)
    for (let i = 1; i <= 8; i++) {
      store.appendMessage('sess_trim', {
        role: 'user',
        content: `User query ${i}`,
      });
      store.appendMessage('sess_trim', {
        role: 'assistant',
        content: `Assistant reply ${i}`,
      });
    }

    const session = store.get('sess_trim')!;
    // System message (1) + 10 most recent conversational messages = 11 messages
    expect(session.messages).toHaveLength(11);
    expect(session.messages[0].role).toBe('system');
    expect(session.messages[0].content).toBe('System rule');
    // First conversational message should be query 4 (queries 1..3 evicted)
    expect(session.messages[1].content).toBe('User query 4');
    expect(session.messages[session.messages.length - 1].content).toBe(
      'Assistant reply 8'
    );
  });

  it('TC-1.4: evicts inactive sessions past TTL', () => {
    store.appendMessage('sess_ttl', {
      role: 'user',
      content: 'Hello',
    });
    expect(store.get('sess_ttl')).not.toBeNull();

    // Advance clock past 30 minutes TTL
    currentTime += 31 * 60 * 1000;

    expect(store.get('sess_ttl')).toBeNull();
  });

  it('clears session messages cleanly without impacting other sessions', () => {
    store.appendMessage('s1', { role: 'user', content: 'Msg in S1' });
    store.appendMessage('s2', { role: 'user', content: 'Msg in S2' });

    store.clear('s1');

    const s1 = store.get('s1')!;
    expect(s1.messages).toHaveLength(0);

    const s2 = store.get('s2')!;
    expect(s2.messages).toHaveLength(1);
    expect(s2.messages[0].content).toBe('Msg in S2');
  });
});
