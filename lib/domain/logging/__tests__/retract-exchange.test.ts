import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/lib/core/types/meal';
import { retractExchange } from '../retract-exchange';

const at = new Date();
const FEED = [
  { id: 'u-0', role: 'user', content: 'older', timestamp: at },
  { id: 'u-1', role: 'user', content: 'phở bò', timestamp: at },
  {
    id: 'msg-1',
    role: 'assistant',
    content: '',
    userInput: 'phở bò',
    timestamp: at,
  },
] as ChatMessage[];

describe('retractExchange', () => {
  it('gives the meal back and takes both halves of the exchange out', () => {
    // The paywall is a page now, not a dialog over the feed: the composer was
    // cleared on submit, so without this the user's words are simply gone.
    const { messages, text } = retractExchange(FEED, 'msg-1');
    expect(text).toBe('phở bò');
    // Both halves of the unanswered exchange leave the feed; older ones stay.
    expect(messages.map((m) => m.id)).toEqual(['u-0']);
  });

  it('keeps an assistant bubble that sits right before the streaming one', () => {
    const feed = [
      { id: 'a-0', role: 'assistant', content: '', timestamp: at },
      { id: 'msg-1', role: 'assistant', content: '', timestamp: at },
    ] as ChatMessage[];
    const { messages, text } = retractExchange(feed, 'msg-1');
    expect(messages.map((m) => m.id)).toEqual(['a-0']);
    expect(text).toBe('');
  });

  it('leaves the feed alone when the bubble is not in it', () => {
    const { messages, text } = retractExchange(FEED, 'gone');
    expect(messages).toEqual(FEED);
    expect(text).toBe('');
  });
});
