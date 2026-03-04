import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WizardShell } from '@/components/onboarding/wizard-shell';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import { ONBOARDING_REQUIRED_STEP } from '@/lib/onboarding/constants';

export default async function OnboardingPage() {
  const profile = await getOnboardingProfile();

  if ((profile?.onboardingStep ?? 0) >= ONBOARDING_REQUIRED_STEP) {
    redirect('/logging');
  }

  const startStep = Math.min((profile?.onboardingStep ?? 0) + 1, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-[#2C2416]/8 backdrop-blur-[2px]" />

      {/* Decorative blur orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] h-[600px] w-[600px] rounded-full bg-[#E8D5B5]/15 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[#C9A87C]/8 blur-[100px]" />
      </div>

      {/* Overlay card */}
      <div className="relative z-10 mx-4 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E8D5B5]/40 bg-[#FEFBF6] shadow-[0_25px_60px_-15px_rgba(44,36,22,0.15)]">
        {/* Skip link */}
        <div className="flex shrink-0 justify-end px-6 pt-4">
          <Link
            href="/logging"
            className="text-[#B0A695] text-sm transition-colors hover:text-[#6B5D4F]"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Bỏ qua, khám phá trước →
          </Link>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <WizardShell initialStep={startStep} initialProfile={profile} />
        </div>
      </div>
    </div>
  );
}
