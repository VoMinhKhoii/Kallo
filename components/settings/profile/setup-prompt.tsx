import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * What the Profile page shows before onboarding has created a profile: the
 * body and cooking pages stay hidden until then, so point at setup.
 */
export function SetupPrompt() {
  const t = useTranslations('settings.profilePage');

  return (
    <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-kallo-border bg-card px-4 py-12 text-center">
      <h3 className="font-semibold text-[16px] text-kallo-text">
        {t('emptyTitle')}
      </h3>
      <p className="max-w-sm text-[14px] text-kallo-text-soft">
        {t('emptyDescription')}
      </p>
      <Link
        href="/onboarding"
        className="rounded-lg bg-kallo-btn px-4 py-2 font-medium text-kallo-btn-ink text-sm"
      >
        {t('startSetup')}
      </Link>
    </div>
  );
}
