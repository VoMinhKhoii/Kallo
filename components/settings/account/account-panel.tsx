'use client';

import { Download, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SettingsGroup, SettingsRow } from '@/components/settings/group';
import { DangerZone } from './danger-zone';
import { LinkedAccounts } from './linked-accounts';
import { useAccountActions } from './use-account-actions';

/**
 * Account settings: sign-in identity, linked methods, data export, sign out,
 * and permanent account deletion — as two grouped list-cards (Apple Settings
 * idiom) rather than a stack of individual cards.
 *
 * Deletion lives in its own danger-variant group as an inline, type-to-confirm
 * panel (not a modal-first flow) in the brand's calm "concern" register —
 * terracotta `nham-danger`, never the cold shadcn `destructive`. Sign out lives
 * here as well as in the user menu so the settings area is self-sufficient.
 */
export function AccountPanel({ email }: { email: string | null }) {
  const t = useTranslations('settings.account');
  const {
    exportPending,
    signOutPending,
    deletePending,
    handleExport,
    handleSignOut,
    handleDelete,
  } = useAccountActions();

  return (
    <div className="font-sans-display">
      <SettingsGroup>
        {email && (
          <SettingsRow label={t('emailLabel')}>
            <p className="text-[15px] text-nham-text-muted">{email}</p>
          </SettingsRow>
        )}

        <SettingsRow
          label={t('linkedTitle')}
          description={t('linkedDescription')}
          layout="stacked"
        >
          <LinkedAccounts />
        </SettingsRow>

        <SettingsRow
          label={t('exportTitle')}
          description={t('exportDescription')}
        >
          <button
            type="button"
            onClick={handleExport}
            disabled={exportPending}
            aria-busy={exportPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-nham-border bg-white px-3.5 py-2 font-medium text-[13px] text-nham-text transition-colors duration-150 hover:bg-nham-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {exportPending ? t('exporting') : t('exportAction')}
          </button>
        </SettingsRow>

        <SettingsRow label={t('signOutTitle')}>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signOutPending}
            aria-busy={signOutPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-nham-border bg-white px-3.5 py-2 font-medium text-[13px] text-nham-text transition-colors duration-150 hover:bg-nham-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('signOutAction')}
          </button>
        </SettingsRow>
      </SettingsGroup>

      <DangerZone onDelete={handleDelete} deleting={deletePending} />
    </div>
  );
}
