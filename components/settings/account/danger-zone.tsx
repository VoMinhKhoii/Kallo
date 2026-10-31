'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  FIELD_CLASS,
  GHOST_BUTTON,
  SECONDARY_BUTTON,
} from '@/components/settings/chrome/controls';
import { SettingsGroup, SettingsRow } from '@/components/settings/chrome/group';

interface DangerZoneProps {
  onDelete: () => void;
  deleting: boolean;
  managementUrl: string | null;
}

/**
 * Permanent account deletion in the terracotta `kallo-danger` concern register.
 * Deliberately an inline, type-to-confirm expansion (never a modal): triggering
 * grows a consequence block, a locale-aware confirm word, and cancel/confirm
 * buttons, with confirm disabled until the typed word matches exactly.
 */
export function DangerZone({
  onDelete,
  deleting,
  managementUrl,
}: DangerZoneProps) {
  const t = useTranslations('settings.account');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const confirmWord = t('deleteConfirmWord');
  const canDelete = confirmText.trim() === confirmWord && !deleting;

  const handleConfirm = () => {
    if (!canDelete) return;
    onDelete();
  };

  return (
    <SettingsGroup className="mt-8 border-kallo-border border-t">
      <SettingsRow
        label={t('deleteTitle')}
        description={t('deleteDescription')}
      >
        {!confirmOpen && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={`${SECONDARY_BUTTON} text-kallo-danger`}
          >
            {t('deleteAction')}
          </button>
        )}
      </SettingsRow>

      {confirmOpen && (
        <div className="py-3">
          <p className="max-w-prose text-[13px] text-kallo-text leading-relaxed">
            {t('deleteConsequence')}
          </p>
          {managementUrl && (
            <div className="mt-3 rounded-lg bg-kallo-danger/5 p-3 text-[13px] text-kallo-text">
              <p>{t('deleteSubscriptionWarning')}</p>
              <a
                href={managementUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-medium text-kallo-danger underline-offset-2 hover:underline"
              >
                {t('deleteManageSubscription')}
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
          <label className="mt-3 block">
            <span className="text-[12px] text-kallo-text-muted">
              {t('deleteConfirmLabel', { word: confirmWord })}
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`${FIELD_CLASS} mt-1.5 sm:w-64`}
            />
          </label>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText('');
              }}
              disabled={deleting}
              className={GHOST_BUTTON}
            >
              {t('deleteCancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canDelete}
              aria-busy={deleting}
              className="inline-flex h-8 items-center rounded-lg bg-kallo-danger px-3 font-medium text-[13px] text-white transition-opacity duration-150 hover:bg-kallo-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-danger/40 disabled:opacity-40"
            >
              {deleting ? t('deleting') : t('deleteConfirmAction')}
            </button>
          </div>
        </div>
      )}
    </SettingsGroup>
  );
}
