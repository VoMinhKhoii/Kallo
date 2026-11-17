import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '../theme-switcher';

const theme = vi.hoisted(() => ({
  resolved: 'light' as 'light' | 'dark' | 'aurora',
  set: vi.fn(),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/hooks/theme/use-theme-choice', () => ({
  useResolvedTheme: () => theme.resolved,
  useThemeChoice: () => ['system', theme.set],
}));

describe('ThemeSwitcher', () => {
  beforeEach(() => theme.set.mockClear());

  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
    ['aurora', 'light'],
  ] as const)('goes from %s to %s in one click', (from, to) => {
    theme.resolved = from;
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getAllByRole('button').at(-1) as HTMLElement);
    expect(theme.set).toHaveBeenCalledWith(to);
  });
});
