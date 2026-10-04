import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../app-shell';

const {
  readStepOneLocaleDraftMock,
  restoreOnboardingNudgeMock,
  wizardShellPropsSpy,
} = vi.hoisted(() => ({
  readStepOneLocaleDraftMock: vi.fn(),
  restoreOnboardingNudgeMock: vi.fn(),
  wizardShellPropsSpy: vi.fn(),
}));

vi.mock('@/lib/domain/onboarding/actions', () => ({
  minimizeOnboardingNudge: vi.fn(),
  restoreOnboardingNudge: restoreOnboardingNudgeMock,
}));

vi.mock('@/lib/domain/onboarding/steps/step-one-locale-draft', () => ({
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

vi.mock('@/components/app/navigation/desktop-sidebar', () => ({
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

vi.mock('@/components/app/navigation/mobile-header', () => ({
  MobileHeader: () => <div data-testid="mobile-header" />,
}));

vi.mock('@/components/app/navigation/mobile/mobile-tab-bar', () => ({
  MobileTabBar: () => <nav data-testid="mobile-tab-bar" />,
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

  it('pins the authenticated shell to the viewport', () => {
    const { container } = render(
      <AppShell onboardingStep={2} initialProfile={null} isFirstSession={false}>
        <div>Content</div>
      </AppShell>
    );

    const shell = container.firstElementChild;
    expect(shell).toHaveClass('fixed', 'inset-0', 'overflow-clip');
    expect(shell).not.toHaveClass('h-dvh');
  });

  it('stacks the page above the mobile tab bar, edge to edge on phones', () => {
    const { container } = render(
      <AppShell onboardingStep={2} initialProfile={null} isFirstSession={false}>
        <div>Content</div>
      </AppShell>
    );

    const shell = container.firstElementChild;
    // A column on phones (page, then bar), the sidebar row from md up.
    expect(shell).toHaveClass('flex-col', 'md:flex-row');
    expect(shell?.lastElementChild).toHaveAttribute(
      'data-testid',
      'mobile-tab-bar'
    );
    // The desktop frame's p-3 applies from md only — pages own the phone gutter.
    const row = shell?.firstElementChild;
    expect(row).toHaveClass('md:p-3');
    expect(row).not.toHaveClass('p-3');
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
