import type { ChatMessage } from '@/lib/core/types/meal';

/**
 * Takes an unanswered exchange back out of the feed: the streaming bubble
 * `msgId`, and the user's bubble right before it. `text` is what the user
 * sent (the streaming bubble's `userInput`), or '' when there is none.
 *
 * For an analysis that never ran (AI analysis is locked): the composer was
 * cleared on submit, so the caller puts `text` back in it.
 */
export function retractExchange(
  messages: readonly ChatMessage[],
  msgId: string
): { messages: ChatMessage[]; text: string } {
  const index = messages.findIndex((msg) => msg.id === msgId);
  if (index < 0) return { messages: [...messages], text: '' };
  const asked = index > 0 ? messages[index - 1] : undefined;
  const askedId = asked?.role === 'user' ? asked.id : null;
  return {
    messages: messages.filter((msg) => msg.id !== msgId && msg.id !== askedId),
    text: messages[index].userInput ?? '',
  };
}
