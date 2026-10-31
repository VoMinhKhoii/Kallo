import type { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** The plan's Upgrade action, to /pricing (which links back here). */
export function UpgradeLink({
  href,
  t,
}: {
  href: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-kallo-ink px-3.5 py-1.5 font-medium text-[14px] text-kallo-surface transition-colors hover:bg-kallo-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
    >
      {t('upgradeCta')}
    </Link>
  );
}
