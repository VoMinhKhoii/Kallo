import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceRow } from '../appearance-row';

const setTheme = vi.fn();
let theme: string | undefined = 'system';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme, setTheme }),
}));

/** The select's trigger is its first button; the open list follows it. */
function openList() {
  const [trigger] = screen.getAllByRole('button');
  fireEvent.click(trigger);
  return screen.getAllByRole('button').slice(1);
}

describe('AppearanceRow', () => {
  beforeEach(() => {
    setTheme.mockClear();
    theme = 'system';
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
    theme = 'aurora';
    render(<AppearanceRow />);
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('aurora');

    const dark = openList().find((option) => option.textContent === 'dark');
    fireEvent.click(dark as HTMLElement);

    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('falls back to System for a value it does not offer', () => {
    theme = 'sepia';
    render(<AppearanceRow />);

    expect(screen.getAllByRole('button')[0]).toHaveTextContent('system');
  });
});
