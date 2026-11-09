import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleSwitcher } from '../locale-switcher';

const replaceMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links to the current route in the other locale', () => {
    render(<LocaleSwitcher />);

    expect(
      screen.getByRole('link', { name: 'Tiếng Việt' }).getAttribute('href')
    ).toBe('/vi/dashboard');
  });

  it('leaves a modified click to the browser', () => {
    render(<LocaleSwitcher />);

    fireEvent.click(screen.getByRole('link', { name: 'Tiếng Việt' }), {
      metaKey: true,
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('switches the current route into the selected locale', async () => {
    render(<LocaleSwitcher />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Tiếng Việt' }));

    expect(replaceMock).toHaveBeenCalledWith('/dashboard', { locale: 'vi' }); // shared hook shape
  });
});
