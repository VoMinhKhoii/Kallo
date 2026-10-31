import type { useTranslations } from 'next-intl';
import { PRIMARY_BUTTON } from '@/components/settings/chrome/controls';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';

/** The plan's Upgrade action, to /pricing (which links back here). */
export function UpgradeLink({
  href,
  t,
}: {
  href: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Link href={href} className={cn(PRIMARY_BUTTON, 'h-8 px-3 text-[13px]')}>
      {t('upgradeCta')}
    </Link>
  );
}
