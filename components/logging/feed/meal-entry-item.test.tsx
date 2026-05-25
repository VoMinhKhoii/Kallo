import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatMessage, MealItem } from '@/lib/types/meal';
import { MealEntryItem } from './meal-entry-item';
import { StreamingMealEntry } from './streaming-meal-entry';

const item: MealItem = {
  id: 'item-1',
  name: 'Sườn nướng',
  quantity: 6,
  unit: 'piece',
  macros: {
    calories: 304,
    protein: 13,
    carbs: 0,
    fat: 27,
  },
};

describe('MealEntryItem', () => {
  it('renders macro and calorie units for confirmed meal rows', () => {
    render(
      <MealEntryItem
        item={item}
        index={0}
        isEditing={false}
        onQuantityChange={() => {}}
      />
    );

    expect(screen.getByText('P:13g')).toBeInTheDocument();
    expect(screen.getByText('C:0g')).toBeInTheDocument();
    expect(screen.getByText('F:27g')).toBeInTheDocument();
    expect(screen.getByText('304 kcal')).toBeInTheDocument();
  });

  it('disables the decrease button at the minimum dish weight', () => {
    render(
      <MealEntryItem
        item={{ ...item, quantity: 10 }}
        index={0}
        isEditing={true}
        onQuantityChange={() => {}}
      />
    );

    expect(screen.getByLabelText('decreaseQuantity')).toBeDisabled();
    expect(screen.getByLabelText('increaseQuantity')).toBeEnabled();
  });

  it('allows decreasing above the minimum dish weight', () => {
    render(
      <MealEntryItem
        item={{ ...item, quantity: 100 }}
        index={0}
        isEditing={true}
        onQuantityChange={() => {}}
      />
    );

    expect(screen.getByLabelText('decreaseQuantity')).toBeEnabled();
  });

  it('renders macro and calorie units for streaming completed rows', () => {
    const message: ChatMessage = {
      id: 'message-1',
      role: 'assistant',
      content: '',
      userInput: '6 miếng sườn nướng',
      timestamp: new Date('2026-04-16T17:00:00.000Z'),
      isStreaming: true,
      streamingPhase: 'assembling',
      streamingItems: [item.name],
      streamingCompletedItems: [item],
    };

    render(<StreamingMealEntry message={message} />);

    expect(screen.getAllByText('P:13g').length).toBeGreaterThan(0);
    expect(screen.getAllByText('C:0g').length).toBeGreaterThan(0);
    expect(screen.getAllByText('F:27g').length).toBeGreaterThan(0);
    expect(screen.getAllByText('304 kcal').length).toBeGreaterThan(0);
  });
});
