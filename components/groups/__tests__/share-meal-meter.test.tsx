import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShareMealMeter } from '@/components/groups/share-meal/meter';

const seats = [
  { id: 'me', avatarUrl: null, initials: 'B', label: 'Bạn', parts: 10 },
  { id: 'u1', avatarUrl: null, initials: 'F1', label: 'Người 1', parts: 10 },
];

function renderMeter(split: boolean, onRemove = vi.fn()) {
  render(
    <ShareMealMeter
      emptyLabel="empty"
      evenlyLabel="evenly"
      onChange={vi.fn()}
      onRemove={onRemove}
      onSplitEvenly={vi.fn()}
      seats={seats}
      showEvenly={false}
      split={split}
      totalKcal={1040}
    />
  );
  return onRemove;
}

describe('ShareMealMeter', () => {
  it('whole mode gives everyone the full dish, not a share of one battery', () => {
    renderMeter(false);
    // A copy sends the whole meal to each person, so each pin must read the
    // whole meal — not the 520 a divided battery would show.
    expect(screen.getAllByText('1040')).toHaveLength(2);
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
  });

  it('whole mode still lets you remove a friend, but never yourself', () => {
    const onRemove = renderMeter(false);
    expect(screen.queryByRole('button', { name: 'Bỏ Bạn' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ Người 1' }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('split mode divides one battery', () => {
    renderMeter(true);
    expect(screen.getAllByText('520')).toHaveLength(2);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
  });
});
