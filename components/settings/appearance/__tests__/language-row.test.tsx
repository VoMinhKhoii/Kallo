import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageRow } from '../language-row';

const { switchLocale, saveOnboardingScreen } = vi.hoisted(() => ({
  switchLocale: vi.fn(),
  saveOnboardingScreen: vi.fn(),
}));

vi.mock('@/hooks/profile/use-locale-switch', () => ({
  useLocaleSwitch: () => switchLocale,
}));
vi.mock('@/lib/domain/onboarding/actions', () => ({ saveOnboardingScreen }));

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
    saveOnboardingScreen.mockReset().mockResolvedValue({ success: true });
  });

  it('stores a new language on the account and switches the page', () => {
    render(<LanguageRow />);
    pick('Tiếng Việt');

    expect(saveOnboardingScreen).toHaveBeenCalledWith(
      1,
      { preferredLocale: 'vi' },
      { advance: false }
    );
    expect(switchLocale).toHaveBeenCalledWith('vi');
  });

  it('does nothing for the language already shown', () => {
    render(<LanguageRow />);
    pick('English');

    expect(saveOnboardingScreen).not.toHaveBeenCalled();
    expect(switchLocale).not.toHaveBeenCalled();
  });
});
