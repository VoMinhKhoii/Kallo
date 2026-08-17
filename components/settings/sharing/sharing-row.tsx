'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SettingsRow } from '@/components/settings/chrome/group';
import { Switch } from '@/components/ui/switch';
import { setAutoShareToCircle } from '@/lib/actions/visibility/sharing-preferences';

/**
 * Auto-share-to-circle preference as one row of the Preferences group.
 * Optimistic toggle: flips immediately, rolls back with a toast if the
 * server action fails. Not an RHF field — it commits on change, like the
 * language row.
 */
export function SharingRow({ initialValue }: { initialValue: boolean }) {
  const t = useTranslations('settings.sharing');
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const handleChange = (checked: boolean) => {
    const previous = enabled;
    setEnabled(checked);

    startTransition(async () => {
      try {
        await setAutoShareToCircle(checked);
      } catch {
        setEnabled(previous);
        toast.error(t('error'));
      }
    });
  };

  return (
    <SettingsRow label={t('autoShareLabel')} description={t('autoShareHint')}>
      <Switch
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={isPending}
        aria-label={t('autoShareLabel')}
      />
    </SettingsRow>
  );
}
