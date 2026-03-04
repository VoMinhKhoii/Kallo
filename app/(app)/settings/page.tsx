import Link from 'next/link';
import { ProfileEditor } from '@/components/onboarding/profile-editor';
import { getOnboardingProfile } from '@/lib/onboarding/actions';

export default async function SettingsPage() {
  const profile = await getOnboardingProfile();

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1
          className="font-semibold text-[#2C2416] text-xl"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Chưa có hồ sơ
        </h1>
        <p
          className="text-[#6B5D4F]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Bạn cần hoàn tất thiết lập ban đầu trước khi chỉnh sửa cài đặt.
        </p>
        <Link
          href="/onboarding"
          className="rounded-lg bg-[#2C2416] px-4 py-2 font-medium text-[#FEFBF6] text-sm"
        >
          Bắt đầu thiết lập
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1
          className="mb-8 font-semibold text-2xl text-[#2C2416]"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Cài đặt hồ sơ
        </h1>
        <ProfileEditor profile={profile} />
      </div>
    </div>
  );
}
