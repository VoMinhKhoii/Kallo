'use client';

import { useTranslations } from 'next-intl';
import { SettingsRow } from '@/components/settings/chrome/group';
import { Switch } from '@/components/ui/switch';
import { useOptimisticPreference } from '@/hooks/settings/use-optimistic-preference';
import { setAutoShareToCircle } from '@/lib/actions/visibility/sharing-preferences';

/** Auto-share-to-circle preference as one row of the Privacy group. */
export function SharingRow({ initialValue }: { initialValue: boolean }) {
  const t = useTranslations('settings.sharing');
  const { enabled, isPending, onChange } = useOptimisticPreference({
    initialValue,
    save: setAutoShareToCircle,
    errorMessage: t('error'),
  });

  return (
    <SettingsRow label={t('autoShareLabel')} description={t('autoShareHint')}>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={isPending}
        aria-label={t('autoShareLabel')}
      />
    </SettingsRow>
  );
}
