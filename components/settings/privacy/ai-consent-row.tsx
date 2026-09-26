'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useAiConsent } from '@/components/privacy/ai-consent-provider';
import { SettingsRow } from '@/components/settings/chrome/group';
import { Switch } from '@/components/ui/switch';

/**
 * Consent to third-party AI processing (App Store 5.1.2(i)) as one row of the
 * Preferences group — where a user withdraws the consent the one-time dialog
 * recorded, or gives it without waiting to be asked. Reads and writes the
 * app-wide `AiConsentProvider`, so the logging surfaces see the change at
 * once; the provider flips optimistically and rolls back on failure.
 */
export function AiConsentRow() {
  const t = useTranslations('settings.aiConsent');
  const { consented, setConsent } = useAiConsent();
  const [isPending, startTransition] = useTransition();

  const handleChange = (checked: boolean) => {
    startTransition(async () => {
      try {
        await setConsent(checked);
      } catch (error) {
        console.error('Failed to update AI consent:', error);
        toast.error(t('error'));
      }
    });
  };

  return (
    <SettingsRow label={t('label')} description={t('hint')}>
      <Switch
        checked={consented}
        onCheckedChange={handleChange}
        disabled={isPending}
        aria-label={t('label')}
      />
    </SettingsRow>
  );
}
