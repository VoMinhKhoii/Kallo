import { render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedCards } from '@/components/logging/feed/feed-cards';
import type { ChatMessage, MealItem } from '@/lib/core/types/meal';

// Decorative, and jsdom implements no 2D context.
vi.mock('@/components/shared/loaders/canvas-loader', () => ({
  CanvasLoader: () => null,
}));

// jsdom runs no animation frames, so a committed `style.opacity` says nothing
// about whether an entrance was scheduled. Record the `initial` prop instead —
// that IS the decision under test.
vi.mock('motion/react', () => {
  const strip = (props: Record<string, unknown>) => {
    const { children, initial, animate, exit, transition, layout, ...rest } =
      props;
    return { children, initial, rest };
  };
  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy({} as Record<string, unknown>, {
      get: (_target, tag: string) => (props: Record<string, unknown>) => {
        const { children, initial, rest } = strip(props);
        return createElement(
          tag,
          { ...rest, 'data-initial': JSON.stringify(initial ?? null) },
          children as ReactNode
        );
      },
    }),
    useReducedMotion: () => false,
  };
});

const DISH = {
  id: 'i1',
  name: 'Bún chả',
  quantity: 1,
  unit: 'phần',
  macros: { calories: 540, protein: 28, carbs: 62, fat: 18 },
} as MealItem;

const BASE = {
  id: 'm1',
  role: 'assistant',
  content: '',
  timestamp: new Date('2026-08-11T12:41:00'),
  userInput: 'bún chả hà nội',
} as const;

const STREAMING = {
  ...BASE,
  isStreaming: true,
  streamingPhase: 'estimating',
  streamingItems: ['Bún chả'],
  streamingCompletedItems: [DISH],
} as ChatMessage;

const REVEALED = {
  ...BASE,
  parsedMeal: {
    mealName: 'Bún chả',
    items: [DISH],
    totalMacros: DISH.macros,
  },
  analysisId: 'a1',
} as ChatMessage;

function cards(messages: ChatMessage[]) {
  return (
    <FeedCards
      orderedPersistedMeals={[]}
      unconfirmedMessages={messages}
      isConfirming={false}
      onDeleteMeal={() => {}}
      onLogAgain={() => {}}
      onUpdateMeal={async () => {}}
      onConfirmMeal={() => {}}
      onConfirmCheatMeal={() => {}}
      onCheatClarify={() => {}}
    />
  );
}

/** The `initial` motion was handed for the last article rendered. */
function lastArticleInitial(container: HTMLElement): string | null {
  const articles = container.querySelectorAll('article');
  return articles[articles.length - 1].getAttribute('data-initial');
}

describe('the seam between the streamed rows and the finished card', () => {
  it('a card that follows a run the user watched does not re-enter', () => {
    const view = render(cards([STREAMING]));
    view.rerender(cards([REVEALED]));

    // The sent message, the ticker and the dishes were all on screen a frame
    // ago. Fading the whole block in from zero blinks content the user was
    // already reading, instead of reading as a card closing around it.
    // `initial: false` — mount at the final state, no entrance at all.
    expect(lastArticleInitial(view.container)).toBe('false');
  });

  it('a card with no run behind it still enters normally', () => {
    // Arriving without a streaming turn in front of it — a staged analysis
    // restored while the feed is already up. Nothing preceded it on screen, so
    // it has a real arrival to animate.
    const view = render(cards([]));
    view.rerender(cards([REVEALED]));
    expect(lastArticleInitial(view.container)).toBe('{"opacity":0}');
  });
});
