'use client';

import { Download, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAsyncAction } from '@/hooks/ui/use-async-action';
import { deleteAccountAction, exportMyDataAction } from '@/lib/actions/account';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { LinkedAccounts } from './linked-accounts';

/**
 * Account settings: data export, sign out, and permanent account deletion.
 *
 * Deletion is an inline, type-to-confirm panel (not a modal-first flow) in the
 * brand's calm "concern" register — terracotta `nham-danger`, never the cold
 * shadcn `destructive`. Sign out lives here as well as in the user menu so the
 * settings area is self-sufficient.
 */
export function AccountPanel({ email }: { email: string | null }) {
  const t = useTranslations('settings.account');
  const exportAction = useAsyncAction();
  const signOutAction = useAsyncAction();
  const deleteAction = useAsyncAction();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const deleting = deleteAction.pending;

  const confirmWord = t('deleteConfirmWord');
  const canDelete = confirmText.trim() === confirmWord && !deleting;

  const handleExport = () =>
    exportAction.run(
      async () => {
        const data = await exportMyDataAction();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const date = data.exportedAt.slice(0, 10);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `nham-data-${date}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      },
      { logLabel: 'Failed to export data:', errorMessage: t('exportError') }
    );

  const handleSignOut = () =>
    signOutAction.run(
      async () => {
        const supabase = createClient();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        document.cookie = 'NEXT_LOCALE=; Path=/; Max-Age=0; SameSite=Lax';
        window.location.assign('/');
      },
      {
        logLabel: 'Failed to sign out:',
        errorMessage: t('signOutAction'),
        keepPendingOnSuccess: true,
      }
    );

  const handleDelete = () => {
    if (!canDelete) return;
    deleteAction.run(
      async () => {
        await deleteAccountAction();
        // The account (and all data) is gone — leave the app entirely.
        document.cookie = 'NEXT_LOCALE=; Path=/; Max-Age=0; SameSite=Lax';
        window.location.assign('/');
      },
      {
        logLabel: 'Failed to delete account:',
        errorMessage: t('deleteError'),
        keepPendingOnSuccess: true,
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 font-sans-display">
      {/* Signed-in identity */}
      {email && (
        <div className="rounded-2xl border border-nham-border/70 bg-white px-4 py-3.5">
          <p className="text-[11px] text-nham-text-muted uppercase tracking-[0.14em]">
            {t('emailLabel')}
          </p>
          <p className="mt-0.5 text-[15px] text-nham-text">{email}</p>
        </div>
      )}

      {/* Linked sign-in methods (connect / disconnect Google & Apple) */}
      <LinkedAccounts />

      {/* Export */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-nham-border/70 bg-white px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[15px] text-nham-text">{t('exportTitle')}</p>
          <p className="mt-0.5 text-[13px] text-nham-text-muted">
            {t('exportDescription')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportAction.pending}
          aria-busy={exportAction.pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-nham-border bg-nham-surface px-3.5 py-2 font-medium text-[13px] text-nham-text transition-colors duration-150 hover:bg-nham-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {exportAction.pending ? t('exporting') : t('exportAction')}
        </button>
      </div>

      {/* Sign out */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-nham-border/70 bg-white px-4 py-3.5">
        <p className="text-[15px] text-nham-text">{t('signOutTitle')}</p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signOutAction.pending}
          aria-busy={signOutAction.pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-nham-border bg-nham-surface px-3.5 py-2 font-medium text-[13px] text-nham-text transition-colors duration-150 hover:bg-nham-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('signOutAction')}
        </button>
      </div>

      {/* Delete — terracotta concern register, inline type-to-confirm */}
      <div
        className={cn(
          'rounded-2xl border bg-white px-4 py-3.5 transition-colors',
          confirmOpen ? 'border-nham-danger/40' : 'border-nham-border/70'
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] text-nham-text">{t('deleteTitle')}</p>
            <p className="mt-0.5 text-[13px] text-nham-text-muted">
              {t('deleteDescription')}
            </p>
          </div>
          {!confirmOpen && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="shrink-0 rounded-xl px-3.5 py-2 font-medium text-[13px] text-nham-danger transition-colors duration-150 hover:bg-nham-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-danger/40"
            >
              {t('deleteAction')}
            </button>
          )}
        </div>

        {confirmOpen && (
          <div className="mt-4 border-nham-border/60 border-t pt-4">
            <p className="text-[13.5px] text-nham-text leading-relaxed">
              {t('deleteConsequence')}
            </p>
            <label className="mt-3 block">
              <span className="text-[12px] text-nham-text-muted">
                {t('deleteConfirmLabel', { word: confirmWord })}
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="mt-1.5 w-full rounded-xl border border-nham-border bg-nham-surface px-3.5 py-2.5 text-[15px] text-nham-text outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-nham-danger/30"
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
                className="rounded-xl px-3.5 py-2 font-medium text-[13px] text-nham-text-muted transition-colors duration-150 hover:text-nham-text disabled:opacity-60"
              >
                {t('deleteCancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete}
                aria-busy={deleting}
                className="rounded-xl bg-nham-danger px-3.5 py-2 font-medium text-[13px] text-white transition-opacity duration-150 hover:bg-nham-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-danger/40 disabled:opacity-40"
              >
                {deleting ? t('deleting') : t('deleteConfirmAction')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
