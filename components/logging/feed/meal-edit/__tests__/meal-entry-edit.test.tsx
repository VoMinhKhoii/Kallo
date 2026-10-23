import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MealEntry } from '@/components/logging/feed/meal-entry/meal-entry';
import type { ChatMessage } from '@/lib/core/types/meal';

const message: ChatMessage = {
  id: 'm1',
  role: 'assistant',
  content: '',
  userInput: 'pho and an iced latte',
  timestamp: new Date('2026-10-23T12:00:00Z'),
  analysisId: 'a1',
  parsedMeal: {
    mealName: 'Lunch',
    totalMacros: { calories: 500, protein: 30, carbs: 60, fat: 12 },
    items: [
      {
        id: 'pho',
        name: 'Pho',
        quantity: 400,
        unit: 'g',
        macros: { calories: 400, protein: 25, carbs: 50, fat: 10 },
      },
      {
        id: 'latte',
        name: 'Iced latte',
        quantity: 100,
        unit: 'g',
        macros: { calories: 100, protein: 5, carbs: 10, fat: 2 },
      },
    ],
  },
};

describe('editing an unsaved meal on web', () => {
  it('opens the dialog from a dish and hands the edit back to Save meal', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<MealEntry message={message} onConfirm={onConfirm} />);

    // No Edit pill and no steppers on the card itself.
    expect(screen.queryByText('edit')).toBeNull();
    await user.click(screen.getAllByRole('button', { name: 'editDish' })[0]);
    await screen.findByRole('dialog');

    await user.click(screen.getAllByRole('button', { name: 'moreServing' })[0]);
    await user.click(screen.getByRole('button', { name: 'done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Pho 400 g → 600 g: 600 + 100 kcal.
    expect(screen.getAllByText('700 kcal').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /confirm/ }));
    expect(onConfirm).toHaveBeenCalledWith([
      { mealItemOrder: 0, newGrams: 600 },
    ]);
  });

  it('offers Discard from its ⋯, behind a confirm', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(<MealEntry message={message} onDiscard={onDiscard} />);
    await user.click(screen.getByRole('button', { name: 'moreOptions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'discard' }));
    expect(onDiscard).not.toHaveBeenCalled();
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('leaves Discard out while a save is in flight', async () => {
    const user = userEvent.setup();
    render(<MealEntry message={message} onDiscard={vi.fn()} isConfirming />);
    await user.click(screen.getByRole('button', { name: 'moreOptions' }));
    expect(
      await screen.findByRole('menuitem', { name: 'edit' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'discard' })).toBeNull();
  });
});
