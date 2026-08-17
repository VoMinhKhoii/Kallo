import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenOrigin } from './screen-origin';

const { switchLocaleMock, writeDraftMock } = vi.hoisted(() => ({
  switchLocaleMock: vi.fn(),
  writeDraftMock: vi.fn(),
}));

vi.mock('@/hooks/profile/use-locale-switch', () => ({
  useLocaleSwitch: () => switchLocaleMock,
}));

vi.mock('@/lib/onboarding/steps/step-one-locale-draft', () => ({
  writeStepOneLocaleDraft: writeDraftMock,
}));

describe('ScreenOrigin', () => {
  beforeEach(() => {
    switchLocaleMock.mockReset();
    writeDraftMock.mockReset();
  });

  it('writes the current step 1 draft before switching locale', async () => {
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
    expect(writeDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      switchLocaleMock.mock.invocationCallOrder[0]
    );
    expect(switchLocaleMock).toHaveBeenCalledWith('vi');
    expect(onChange).toHaveBeenLastCalledWith({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });
  });
});
