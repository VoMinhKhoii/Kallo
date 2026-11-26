import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageRow } from '../language-row';

const { switchLocale, saveOnboardingScreen, toastError } = vi.hoisted(() => ({
  switchLocale: vi.fn(),
  saveOnboardingScreen: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/profile/use-locale-switch', () => ({
  useLocaleSwitch: () => switchLocale,
}));
vi.mock('@/lib/domain/onboarding/actions', () => ({ saveOnboardingScreen }));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

/** The select's trigger is its first button; the open list follows it. */
function pick(label: string) {
  const [trigger] = screen.getAllByRole('button');
  fireEvent.click(trigger);
  const option = screen
    .getAllByRole('button')
    .slice(1)
    .find((button) => button.textContent === label);
  if (!option) throw new Error(`no option ${label}`);
  fireEvent.click(option);
}

// The account holds one language: push text is written in it and the phone
// app follows it, so a pick on the web is stored, not only shown.
describe('LanguageRow', () => {
  beforeEach(() => {
    switchLocale.mockClear();
    toastError.mockClear();
    saveOnboardingScreen.mockReset().mockResolvedValue({ success: true });
  });

  it('stores a new language on the account, then switches the page', async () => {
    render(<LanguageRow />);
    pick('Tiếng Việt');

    expect(saveOnboardingScreen).toHaveBeenCalledWith(
      1,
      { preferredLocale: 'vi' },
      { advance: false }
    );
    await waitFor(() => expect(switchLocale).toHaveBeenCalledWith('vi'));
  });

  it('stays on the page and says so when the account save fails', async () => {
    saveOnboardingScreen.mockRejectedValue(new Error('offline'));
    render(<LanguageRow />);
    pick('Tiếng Việt');

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('profilePanel.saveError')
    );
    expect(switchLocale).not.toHaveBeenCalled();
  });

  it('does nothing for the language already shown', () => {
    render(<LanguageRow />);
    pick('English');

    expect(saveOnboardingScreen).not.toHaveBeenCalled();
    expect(switchLocale).not.toHaveBeenCalled();
  });
});
