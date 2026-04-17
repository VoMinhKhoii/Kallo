import { Link } from '@/i18n/navigation';
import { Profile } from '@/components/settings/profile';
import { getOnboardingProfile } from '@/lib/onboarding/actions';

export default async function ProfileSettingsPage() {
  const profile = await getOnboardingProfile();

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        <h1
          className="font-semibold text-[#2C2416] text-xl"
          style={{ fontFamily: 'Lora, serif' }}
        >
          No profile found
        </h1>
        <p
          className="text-center text-[#6B5D4F]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          You need to complete the initial setup before editing your settings.
        </p>
        <Link
          href="/onboarding"
          className="rounded-lg bg-[#2C2416] px-4 py-2 font-medium text-[#FEFBF6] text-sm"
        >
          Start setup
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1
          className="font-medium text-2xl text-[#2C2416] tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Profile
        </h1>
        <p
          className="mt-1 text-[#8B8682] text-[14px]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Manage your body metrics, regional preferences, and cooking habits.
        </p>
      </div>
      <Profile profile={profile} />
    </div>
  );
}
