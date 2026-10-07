import { createL4Cache, type L4Cache } from './l4-cache';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: number;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  createdAt: number;
  lastActiveAt: number;
}

export interface ChatSessionStoreConfig {
  maxEntries?: number;
  ttlMs?: number;
  maxTurns?: number;
  now?: () => number;
}

export interface GeminiContentPart {
  text: string;
}

export interface GeminiContentItem {
  role: 'user' | 'model';
  parts: GeminiContentPart[];
}

export interface GeminiFormattedPrompt {
  systemInstruction?: string;
  contents: GeminiContentItem[];
}

export interface GenericLlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatSessionStore {
  get(sessionId: string): ChatSession | null;
  getOrCreate(sessionId: string): ChatSession;
  appendMessage(
    sessionId: string,
    message: { role: ChatRole; content: string; timestamp?: number }
  ): ChatSession;
  clear(sessionId: string): void;
  size(): number;
  formatForGemini(session: ChatSession): GeminiFormattedPrompt;
  formatForGenericLlm(session: ChatSession): GenericLlmMessage[];
}

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_TURNS = 20;

export function createChatSessionStore(
  cfg: ChatSessionStoreConfig = {}
): ChatSessionStore {
  const now = cfg.now ?? (() => Date.now());
  const maxTurns = cfg.maxTurns ?? DEFAULT_MAX_TURNS;

  const cache: L4Cache<ChatSession> = createL4Cache<ChatSession>({
    maxEntries: cfg.maxEntries ?? DEFAULT_MAX_ENTRIES,
    ttlMs: cfg.ttlMs ?? DEFAULT_TTL_MS,
    now,
  });

  function get(sessionId: string): ChatSession | null {
    return cache.get(sessionId);
  }

  function getOrCreate(sessionId: string): ChatSession {
    const existing = cache.get(sessionId);
    if (existing) {
      return existing;
    }
    const currentTime = now();
    const fresh: ChatSession = {
      sessionId,
      messages: [],
      createdAt: currentTime,
      lastActiveAt: currentTime,
    };
    cache.set(sessionId, fresh);
    return fresh;
  }

  function appendMessage(
    sessionId: string,
    message: { role: ChatRole; content: string; timestamp?: number }
  ): ChatSession {
    const session = getOrCreate(sessionId);
    const timestamp = message.timestamp ?? now();
    const newMsg: ChatMessage = {
      role: message.role,
      content: message.content,
      timestamp,
    };

    const updatedMessages = [...session.messages, newMsg];

    // Separate system messages from conversational turns for trimming
    const systemMessages = updatedMessages.filter((m) => m.role === 'system');
    const conversationalMessages = updatedMessages.filter(
      (m) => m.role !== 'system'
    );

    // Keep at most maxTurns * 2 conversational messages (user/assistant pairs)
    const maxMessages = maxTurns * 2;
    const trimmedConversational =
      conversationalMessages.length > maxMessages
        ? conversationalMessages.slice(-maxMessages)
        : conversationalMessages;

    const finalMessages = [...systemMessages, ...trimmedConversational];

    const updatedSession: ChatSession = {
      ...session,
      messages: finalMessages,
      lastActiveAt: timestamp,
    };

    cache.set(sessionId, updatedSession);
    return updatedSession;
  }

  function clear(sessionId: string): void {
    const existing = cache.get(sessionId);
    if (existing) {
      cache.set(sessionId, {
        sessionId,
        messages: [],
        createdAt: now(),
        lastActiveAt: now(),
      });
    }
  }

  function formatForGemini(session: ChatSession): GeminiFormattedPrompt {
    let systemInstruction: string | undefined;
    const contents: GeminiContentItem[] = [];

    for (const msg of session.messages) {
      if (msg.role === 'system') {
        systemInstruction = systemInstruction
          ? `${systemInstruction}\n${msg.content}`
          : msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  function formatForGenericLlm(session: ChatSession): GenericLlmMessage[] {
    return session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  return {
    get,
    getOrCreate,
    appendMessage,
    clear,
    size: () => cache.size(),
    formatForGemini,
    formatForGenericLlm,
  };
}
