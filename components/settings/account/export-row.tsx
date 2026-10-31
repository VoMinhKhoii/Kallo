'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SettingsRow } from '@/components/settings/chrome/group';
import { ROW_BUTTON } from './row-button';
import { useAccountActions } from './use-account-actions';

/** Export my data — a JSON download of everything in the account. */
export function ExportRow({ userId }: { userId: string }) {
  const t = useTranslations('settings.account');
  const { exportPending, handleExport } = useAccountActions(userId);

  return (
    <SettingsRow label={t('exportTitle')} description={t('exportDescription')}>
      <button
        type="button"
        onClick={handleExport}
        disabled={exportPending}
        aria-busy={exportPending}
        className={ROW_BUTTON}
      >
        <Download className="h-3.5 w-3.5" />
        {exportPending ? t('exporting') : t('exportAction')}
      </button>
    </SettingsRow>
  );
}
