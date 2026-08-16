import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StreamingMealEntry } from '@/components/logging/feed/streaming/streaming-meal-entry';
import type { ChatMessage, MealItem } from '@/lib/types/meal';

// Decorative, and jsdom implements no 2D context.
vi.mock('@/components/shared/loaders/canvas-loader', () => ({
  CanvasLoader: () => null,
}));

const DISH = {
  id: 'i1',
  name: 'Bún chả',
  quantity: 1,
  unit: 'phần',
  macros: { calories: 540, protein: 28, carbs: 62, fat: 18 },
} as MealItem;

function streamingMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: new Date('2026-08-11T12:41:00'),
    isStreaming: true,
    userInput: 'bún chả hà nội',
    streamingPhase: 'estimating',
    streamingItems: ['Bún chả', 'Bia Hà Nội'],
    streamingCompletedItems: [DISH],
    ...overrides,
  } as ChatMessage;
}

describe('a meal mid-analysis', () => {
  it('draws no card around the half-filled result', () => {
    const { container } = render(
      <StreamingMealEntry message={streamingMessage()} />
    );

    // A card is what a FINISHED answer looks like. Wrapping a skeleton in one
    // promised a result that wasn't there yet; the card is closed around these
    // rows only once the analysis completes.
    expect(container.querySelector('.bg-white')).toBeNull();
    expect(container.querySelector('.rounded-2xl')).toBeNull();
  });

  it('carries the user words as a sent message', () => {
    render(<StreamingMealEntry message={streamingMessage()} />);
    // The analysis reads as a reply to something the user said, from the moment
    // they hit send — not only once the answer lands.
    expect(screen.getByText('bún chả hà nội')).toBeInTheDocument();
  });

  it('keeps the loading state above the rows, not below them', () => {
    const { container } = render(
      <StreamingMealEntry message={streamingMessage()} />
    );

    const ticker = container.querySelector('[aria-live="polite"]');
    const dish = screen.getByText('Bún chả');
    expect(ticker).not.toBeNull();
    // Trailing the rows, the ticker slid down every time a dish landed and the
    // loading state visibly jumped. DOCUMENT_POSITION_FOLLOWING === 4.
    expect(
      (ticker as Element).compareDocumentPosition(dish) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('insets its rows the way the card will, so the reveal does not shift them', () => {
    const { container } = render(
      <StreamingMealEntry message={streamingMessage()} />
    );
    // `MealEntry` closes a `p-4 sm:p-5` card around these rows. Without the
    // matching inset every row slides sideways as the chrome appears.
    expect(container.querySelector('.px-4.sm\\:px-5')).not.toBeNull();
  });
});
