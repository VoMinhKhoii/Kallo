import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

const {
  readStepOneLocaleDraftMock,
  restoreOnboardingNudgeMock,
  wizardShellPropsSpy,
} = vi.hoisted(() => ({
  readStepOneLocaleDraftMock: vi.fn(),
  restoreOnboardingNudgeMock: vi.fn(),
  wizardShellPropsSpy: vi.fn(),
}));

vi.mock('@/lib/onboarding/actions', () => ({
  minimizeOnboardingNudge: vi.fn(),
  restoreOnboardingNudge: restoreOnboardingNudgeMock,
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

vi.mock('../navigation/desktop-sidebar', () => ({
  DesktopSidebar: ({
    onboardingIncomplete,
    isOnboardingMinimized,
    onRestoreOnboarding,
    onResumeOnboarding,
  }: {
    onboardingIncomplete: boolean;
    isOnboardingMinimized: boolean;
    onRestoreOnboarding: () => Promise<void>;
    onResumeOnboarding: () => void;
  }) => (
    <div>
      <div>{String(onboardingIncomplete)}</div>
      <div data-testid="minimized-state">{String(isOnboardingMinimized)}</div>
      <button type="button" onClick={onRestoreOnboarding}>
        Restore nudge
      </button>
      <button type="button" onClick={onResumeOnboarding}>
        Resume onboarding
      </button>
    </div>
  ),
}));

vi.mock('../navigation/mobile-nav', () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}));

describe('AppShell', () => {
  beforeEach(() => {
    readStepOneLocaleDraftMock.mockReset();
    readStepOneLocaleDraftMock.mockReturnValue(null);
    restoreOnboardingNudgeMock.mockReset();
    restoreOnboardingNudgeMock.mockResolvedValue(undefined);
    wizardShellPropsSpy.mockReset();
  });

  it('reopens onboarding at step 1 when a locale draft exists', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('Wizard Shell')).toBeInTheDocument();
    });
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

  it('rolls the minimized nudge back when restore persistence fails', async () => {
    const user = userEvent.setup();
    restoreOnboardingNudgeMock.mockRejectedValue(new Error('network'));

    render(
      <AppShell
        onboardingStep={2}
        initialProfile={
          {
            countryOfOrigin: 'Vietnam',
            onboardingMinimizedAt: new Date('2026-05-01T00:00:00Z'),
            onboardingStep: 2,
          } as never
        }
        isFirstSession={false}
      >
        <div>Content</div>
      </AppShell>
    );

    expect(screen.getByTestId('minimized-state')).toHaveTextContent('true');

    await user.click(screen.getByRole('button', { name: 'Restore nudge' }));

    await waitFor(() => {
      expect(screen.getByTestId('minimized-state')).toHaveTextContent('true');
    });
  });
});
