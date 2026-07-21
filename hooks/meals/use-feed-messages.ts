'use client';

import { useMemo } from 'react';
import type { useStreamAnalysis } from '@/hooks/meals/use-stream-analysis';
import type { PendingMealConfirmation } from '@/lib/actions/meals/types';
import type { ChatMessage, StreamingPhase } from '@/lib/types/meal';

function toStreamingPhase(status: string): StreamingPhase {
  switch (status) {
    case 'decomposing':
      return 'decomposing';
    case 'matching':
      return 'matching';
    case 'estimating':
      return 'estimating';
    case 'assembling':
      return 'assembling';
    case 'done':
    case 'error':
      return 'assembling';
    default:
      return 'waiting';
  }
}

/**
 * Derives what the feed renders: the selected day's local messages with live
 * streaming state overlaid, plus server-pending confirmations that don't have
 * a live in-session twin (rendering the twin would remount the card and reset
 * in-progress slider levels / quantity edits mid-edit).
 */
export function useFeedMessages(args: {
  messages: ChatMessage[];
  selectedDate: string;
  streamingMsgId: string | null;
  stream: ReturnType<typeof useStreamAnalysis>;
  pendingConfirmations: PendingMealConfirmation[];
}) {
  const { messages, selectedDate, streamingMsgId, stream } = args;

  // Derive display messages: overlay live streaming state onto the active message.
  const displayMessages = useMemo(() => {
    const selectedMessages = messages.filter(
      (message) => message.loggedDate === selectedDate
    );

    if (!streamingMsgId || stream.status === 'idle') return selectedMessages;

    return selectedMessages.map((msg) => {
      if (msg.id !== streamingMsgId) return msg;
      return {
        ...msg,
        isStreaming: true,
        streamingPhase: toStreamingPhase(stream.status),
        streamingItems:
          stream.items.length > 0 ? stream.items : msg.streamingItems,
        streamingCompletedItems:
          stream.completedItems.length > 0
            ? stream.completedItems
            : msg.streamingCompletedItems,
      };
    });
  }, [
    messages,
    selectedDate,
    streamingMsgId,
    stream.status,
    stream.items,
    stream.completedItems,
  ]);

  // Analyses that still have a live, in-session card. We render those from the
  // local streamed message — it holds the user's in-progress slider levels /
  // quantity edits in component state. Rendering the server-pending twin instead
  // (after a background refetch lands `pendingConfirmations`) would mount a
  // different React element and reset that state mid-edit, so we suppress the
  // twin until the local card is gone (confirmed/dismissed).
  const localAnalysisIds = useMemo(
    () =>
      new Set(
        displayMessages
          .filter((m) => m.role === 'assistant' && m.analysisId)
          .map((m) => m.analysisId as string)
      ),
    [displayMessages]
  );

  const pendingMessages = useMemo<ChatMessage[]>(
    () =>
      args.pendingConfirmations
        .filter((pending) => !localAnalysisIds.has(pending.id))
        .map((pending) => ({
          id: `pending-${pending.id}`,
          role: 'assistant',
          content: '',
          parsedMeal: pending.parsedMeal,
          cheatSpec: pending.cheatSpec,
          userInput: pending.rawInput,
          timestamp: new Date(pending.loggedAt),
          loggedDate: selectedDate,
          analysisId: pending.id,
          attemptId: pending.attemptId,
        })),
    [args.pendingConfirmations, selectedDate, localAnalysisIds]
  );

  const unconfirmedMessages = [
    ...pendingMessages,
    ...displayMessages.filter((m) => m.role === 'assistant'),
  ];

  return {
    displayMessages,
    pendingMessages,
    unconfirmedMessages,
  };
}
