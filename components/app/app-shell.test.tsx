import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

const { readStepOneLocaleDraftMock, wizardShellPropsSpy } = vi.hoisted(() => ({
  readStepOneLocaleDraftMock: vi.fn(),
  wizardShellPropsSpy: vi.fn(),
}));

vi.mock('@/lib/onboarding/step-one-locale-draft', () => ({
  readStepOneLocaleDraft: readStepOneLocaleDraftMock,
}));

vi.mock('@/components/onboarding/wizard-shell', () => ({
  WizardShell: (props: {
    initialStep: number;
    initialProfile: unknown;
    onClose?: () => void;
    onComplete?: () => void;
  }) => {
    wizardShellPropsSpy(props);
    return <div>Wizard Shell</div>;
  },
}));

vi.mock('./main-sidebar', () => ({
  MainSidebar: ({
    onboardingIncomplete,
    onResumeOnboarding,
  }: {
    onboardingIncomplete: boolean;
    onResumeOnboarding: () => void;
  }) => (
    <div>
      <div>{String(onboardingIncomplete)}</div>
      <button type="button" onClick={onResumeOnboarding}>
        Resume onboarding
      </button>
    </div>
  ),
}));

describe('AppShell', () => {
  beforeEach(() => {
    readStepOneLocaleDraftMock.mockReset();
    readStepOneLocaleDraftMock.mockReturnValue(null);
    wizardShellPropsSpy.mockReset();
  });

  it('reopens onboarding at step 1 when a locale draft exists', () => {
    readStepOneLocaleDraftMock.mockReturnValue({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Australia',
      preferredLocale: 'vi',
    });

    render(
      <AppShell
        onboardingStep={2}
        initialProfile={
          {
            countryOfOrigin: 'Vietnam',
            onboardingStep: 2,
          } as never
        }
        isFirstSession={false}
      >
        <div>Content</div>
      </AppShell>
    );

    expect(screen.getByText('Wizard Shell')).toBeInTheDocument();
    expect(wizardShellPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialStep: 1,
      })
    );
  });

  it('uses the resume step when no locale draft exists', async () => {
    const user = userEvent.setup();

    render(
      <AppShell
        onboardingStep={2}
        initialProfile={
          {
            countryOfOrigin: 'Vietnam',
            onboardingStep: 2,
          } as never
        }
        isFirstSession={false}
      >
        <div>Content</div>
      </AppShell>
    );

    await user.click(screen.getByRole('button', { name: 'Resume onboarding' }));

    expect(screen.getByText('Wizard Shell')).toBeInTheDocument();
    expect(wizardShellPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialStep: 3,
      })
    );
  });
});
