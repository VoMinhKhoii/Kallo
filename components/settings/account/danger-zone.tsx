'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  DANGER_BUTTON,
  FIELD_CLASS,
} from '@/components/settings/chrome/controls';
import { SettingsGroup, SettingsRow } from '@/components/settings/chrome/group';
import { ConfirmDialog } from '@/components/shared/confirm-dialog/confirm-dialog';

interface DangerZoneProps {
  onDelete: () => void;
  deleting: boolean;
  managementUrl: string | null;
}

/**
 * Permanent account deletion: the row's red button opens the app's shared
 * confirm dialog, which names the consequence, warns that an active
 * subscription keeps billing, and keeps its red action disabled until the
 * locale's confirm word is typed exactly.
 */
export function DangerZone({
  onDelete,
  deleting,
  managementUrl,
}: DangerZoneProps) {
  const t = useTranslations('settings.account');
  const [confirmText, setConfirmText] = useState('');
  const confirmWord = t('deleteConfirmWord');

  return (
    <SettingsGroup>
      <SettingsRow
        label={t('deleteTitle')}
        description={t('deleteDescription')}
      >
        <ConfirmDialog
          trigger={
            <button type="button" className={DANGER_BUTTON}>
              {t('deleteAction')}
            </button>
          }
          onOpenChange={(open) => {
            if (!open) setConfirmText('');
          }}
          title={t('deleteTitle')}
          description={t('deleteConsequence')}
          confirmLabel={deleting ? t('deleting') : t('deleteConfirmAction')}
          cancelLabel={t('deleteCancel')}
          tone="destructive"
          pending={deleting}
          confirmDisabled={confirmText.trim() !== confirmWord}
          onConfirm={(event) => {
            // Stay open while the deletion runs; success leaves the app.
            event.preventDefault();
            onDelete();
          }}
        >
          <div className="flex flex-col gap-3">
            {managementUrl && (
              <div className="rounded-lg bg-kallo-danger/5 p-3 text-[13px] text-kallo-text">
                <p>{t('deleteSubscriptionWarning')}</p>
                <a
                  href={managementUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-medium text-kallo-danger underline-offset-2 hover:underline"
                >
                  {t('deleteManageSubscription')}
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-kallo-text-muted">
                {t('deleteConfirmLabel', { word: confirmWord })}
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={FIELD_CLASS}
              />
            </label>
          </div>
        </ConfirmDialog>
      </SettingsRow>
    </SettingsGroup>
  );
}
