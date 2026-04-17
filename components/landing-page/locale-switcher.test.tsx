import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleSwitcher } from './locale-switcher';

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

  it('switches the current route into the selected locale', async () => {
    render(<LocaleSwitcher />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tiếng Việt' }));

    expect(replaceMock).toHaveBeenCalledWith('/dashboard', { locale: 'vi' });
  });
});
