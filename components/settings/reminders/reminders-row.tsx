'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SettingsRow } from '@/components/settings/chrome/group';
import { Switch } from '@/components/ui/switch';
import { setMealReminders } from '@/lib/actions/notifications/reminder-preferences';

/**
 * The meal-reminder switch, one row of the Preferences group. The reminders
 * themselves are iOS pushes; the switch lives here too so it can be turned off
 * from either app. Optimistic, like the sharing row: flips immediately, rolls
 * back with a toast if the server action fails.
 */
export function RemindersRow({ initialValue }: { initialValue: boolean }) {
  const t = useTranslations('settings.reminders');
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // A value changed elsewhere (another device, the app) arrives as a new prop
  // while the row stays mounted, so `useState(initialValue)` alone would keep
  // showing the old one. Adopt a new server value when one arrives, unless a
  // toggle of ours is still in flight.
  const [seenValue, setSeenValue] = useState(initialValue);
  if (initialValue !== seenValue && !isPending) {
    setSeenValue(initialValue);
    setEnabled(initialValue);
  }

  const handleChange = (checked: boolean) => {
    const previous = enabled;
    setEnabled(checked);

    startTransition(async () => {
      try {
        await setMealReminders(checked);
        // The row remounts from the shell's profile each time its settings
        // page opens; refetch it so coming back shows the saved value.
        router.refresh();
      } catch {
        setEnabled(previous);
        toast.error(t('error'));
      }
    });
  };

  return (
    <SettingsRow label={t('label')} description={t('hint')}>
      <Switch
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={isPending}
        aria-label={t('label')}
      />
    </SettingsRow>
  );
}
