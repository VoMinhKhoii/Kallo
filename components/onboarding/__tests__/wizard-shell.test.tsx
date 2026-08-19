import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WizardShell } from '../wizard-shell';

const {
  clearStepOneLocaleDraftMock,
  currentLocaleRef,
  pushMock,
  readStepOneLocaleDraftMock,
  saveOnboardingScreenMock,
  screenOriginPropsSpy,
} = vi.hoisted(() => ({
  clearStepOneLocaleDraftMock: vi.fn(),
  currentLocaleRef: { value: 'en' as 'en' | 'vi' },
  pushMock: vi.fn(),
  readStepOneLocaleDraftMock: vi.fn(),
  saveOnboardingScreenMock: vi.fn().mockResolvedValue(undefined),
  screenOriginPropsSpy: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(`{${k}}`, String(v)),
          key
        );
      }
      return key;
    };
    t.rich = t;
    t.raw = t;
    return t;
  },
  useLocale: () => currentLocaleRef.value,
}));

vi.mock('@/lib/domain/onboarding/actions', () => ({
  saveOnboardingScreen: saveOnboardingScreenMock,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/domain/onboarding/steps/step-one-locale-draft', () => ({
  clearStepOneLocaleDraft: clearStepOneLocaleDraftMock,
  readStepOneLocaleDraft: readStepOneLocaleDraftMock,
}));

vi.mock('../screen-body-metrics', () => ({
  ScreenBodyMetrics: () => <div>Body Metrics &amp; Targets</div>,
}));

vi.mock('../screen-origin', () => ({
  ScreenOrigin: ({
    defaultValues,
    onChange,
  }: {
    defaultValues: {
      countryOfOrigin: string | null;
      countryOfResidence: string | null;
      preferredLocale: 'en' | 'vi';
    };
    onChange: (data: {
      countryOfOrigin: string | null;
      countryOfResidence: string | null;
      preferredLocale: 'en' | 'vi';
    }) => void;
  }) => {
    screenOriginPropsSpy(defaultValues);
    const lastReportedSignature = React.useRef<string | null>(null);

    React.useEffect(() => {
      const signature = JSON.stringify(defaultValues);
      if (lastReportedSignature.current === signature) {
        return;
      }

      lastReportedSignature.current = signature;
      onChange(defaultValues);
    }, [defaultValues, onChange]);

    return <div>Origin</div>;
  },
}));

vi.mock('../screen-cooking', () => ({
  ScreenCooking: () => <div>Cooking Habits</div>,
}));

vi.mock('../step-indicator', () => ({
  StepIndicator: () => <div>Step Indicator</div>,
}));

describe('WizardShell', () => {
  beforeEach(() => {
    clearStepOneLocaleDraftMock.mockReset();
    currentLocaleRef.value = 'en';
    pushMock.mockReset();
    readStepOneLocaleDraftMock.mockReset();
    readStepOneLocaleDraftMock.mockReturnValue(null);
    saveOnboardingScreenMock.mockClear();
    screenOriginPropsSpy.mockClear();
  });

  it('uses a narrower dialog width on screen 3', () => {
    render(<WizardShell initialStep={3} initialProfile={null} />);

    expect(screen.getByRole('dialog')).toHaveClass('max-w-[58rem]');
    expect(screen.getByText('Cooking Habits')).toBeInTheDocument();
  });

  it('passes the active route locale to step 1 defaults', async () => {
    currentLocaleRef.value = 'vi';

    render(
      <WizardShell
        initialStep={1}
        initialProfile={
          {
            countryOfOrigin: 'Vietnam',
            countryOfResidence: 'Australia',
            preferredLocale: 'en',
          } as never
        }
      />
    );

    await waitFor(() =>
      expect(screenOriginPropsSpy).toHaveBeenCalledWith({
        countryOfOrigin: 'Vietnam',
        countryOfResidence: 'Australia',
        preferredLocale: 'vi',
      })
    );
  });

  it('hydrates step 1 from the transient draft and clears it after reading', async () => {
    readStepOneLocaleDraftMock.mockReturnValue({
      countryOfOrigin: 'Japan',
      countryOfResidence: 'Singapore',
      preferredLocale: 'vi',
    });

    render(<WizardShell initialStep={1} initialProfile={null} />);

    await waitFor(() =>
      expect(screenOriginPropsSpy).toHaveBeenCalledWith({
        countryOfOrigin: 'Japan',
        countryOfResidence: 'Singapore',
        preferredLocale: 'vi',
      })
    );
    expect(clearStepOneLocaleDraftMock).toHaveBeenCalledTimes(1);
  });

  it('saves the hydrated preferredLocale when the user clicks Next', async () => {
    const user = userEvent.setup();

    readStepOneLocaleDraftMock.mockReturnValue({
      countryOfOrigin: 'Japan',
      countryOfResidence: 'Singapore',
      preferredLocale: 'vi',
    });

    render(<WizardShell initialStep={1} initialProfile={null} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^next$/i })).toBeEnabled()
    );

    await user.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(() =>
      expect(saveOnboardingScreenMock).toHaveBeenCalledWith(1, {
        countryOfOrigin: 'Japan',
        countryOfResidence: 'Singapore',
        preferredLocale: 'vi',
      })
    );
  });
});
