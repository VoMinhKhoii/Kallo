import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceRow } from '../appearance-row';

const setChoice = vi.fn();
let choice = 'system';

vi.mock('@/hooks/theme/use-theme-choice', () => ({
  useThemeChoice: () => [choice, setChoice],
}));

/** The select's trigger is its first button; the open list follows it. */
function openList() {
  const [trigger] = screen.getAllByRole('button');
  fireEvent.click(trigger);
  return screen.getAllByRole('button').slice(1);
}

describe('AppearanceRow', () => {
  beforeEach(() => {
    setChoice.mockClear();
    choice = 'system';
  });

  it('lists System, Light, Dark and Aurora in that order', () => {
    render(<AppearanceRow />);

    expect(openList().map((option) => option.textContent)).toEqual([
      'system',
      'light',
      'dark',
      'aurora',
    ]);
  });

  it('shows the stored choice and saves a new one', () => {
    choice = 'aurora';
    render(<AppearanceRow />);
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('aurora');

    const dark = openList().find((option) => option.textContent === 'dark');
    fireEvent.click(dark as HTMLElement);

    expect(setChoice).toHaveBeenCalledWith('dark');
  });
});
