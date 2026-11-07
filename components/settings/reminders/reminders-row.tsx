'use client';

import { useTranslations } from 'next-intl';
import { SettingsRow } from '@/components/settings/chrome/group';
import { Switch } from '@/components/ui/switch';
import { useOptimisticPreference } from '@/hooks/settings/use-optimistic-preference';
import { setMealReminders } from '@/lib/actions/notifications/reminder-preferences';

/**
 * The meal-reminder switch, one row of the Preferences group. The reminders
 * themselves are iOS pushes; the switch lives here too so it can be turned off
 * from either app.
 */
export function RemindersRow({ initialValue }: { initialValue: boolean }) {
  const t = useTranslations('settings.reminders');
  const { enabled, isPending, onChange } = useOptimisticPreference({
    initialValue,
    save: setMealReminders,
    errorMessage: t('error'),
  });

  return (
    <SettingsRow label={t('label')} description={t('hint')}>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={isPending}
        aria-label={t('label')}
      />
    </SettingsRow>
  );
}
