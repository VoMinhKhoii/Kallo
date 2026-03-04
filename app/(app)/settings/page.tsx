import Link from 'next/link';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import { ProfileEditor } from '@/components/onboarding/profile-editor';

export default async function SettingsPage() {
  const profile = await getOnboardingProfile();

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="font-semibold text-xl">
          Chưa có hồ sơ
        </h1>
        <p className="text-muted-foreground">
          Bạn cần hoàn tất thiết lập ban đầu trước khi chỉnh
          sửa cài đặt.
        </p>
        <Link
          href="/onboarding"
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
        >
          Bắt đầu thiết lập
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-8 font-semibold text-2xl">
          Cài đặt hồ sơ
        </h1>
        <ProfileEditor profile={profile} />
      </div>
    </div>
  );
}
