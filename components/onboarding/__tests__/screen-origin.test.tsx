import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenOrigin } from '../screen-origin';

const { switchLocaleMock, writeDraftMock, saveMock } = vi.hoisted(() => ({
  switchLocaleMock: vi.fn(),
  writeDraftMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock('@/lib/domain/onboarding/actions', () => ({
  saveOnboardingScreen: saveMock,
}));

vi.mock('@/hooks/profile/use-locale-switch', () => ({
  useLocaleSwitch: () => switchLocaleMock,
}));

vi.mock('@/lib/domain/onboarding/steps/step-one-locale-draft', () => ({
  writeStepOneLocaleDraft: writeDraftMock,
}));

describe('ScreenOrigin', () => {
  beforeEach(() => {
    switchLocaleMock.mockReset();
    writeDraftMock.mockReset();
    saveMock.mockReset().mockResolvedValue({ success: true });
  });

  // The account holds the language push text is written in and the phone app
  // follows: the pick is stored there before the page switches.
  it('writes the draft, stores the language, then switches locale', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ScreenOrigin
        defaultValues={{
          countryOfOrigin: 'Vietnam',
          countryOfResidence: 'Australia',
          preferredLocale: 'en',
        }}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /tiếng việt/i }));

    expect(writeDraftMock).toHaveBeenCalledWith({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });
    await waitFor(() => expect(switchLocaleMock).toHaveBeenCalledWith('vi'));
    expect(saveMock).toHaveBeenCalledWith(
      1,
      { preferredLocale: 'vi' },
      { advance: false }
    );
    expect(writeDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      saveMock.mock.invocationCallOrder[0]
    );
    expect(saveMock.mock.invocationCallOrder[0]).toBeLessThan(
      switchLocaleMock.mock.invocationCallOrder[0]
    );
    expect(onChange).toHaveBeenLastCalledWith({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });
  });
});
