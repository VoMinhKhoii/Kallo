'use client';

import { useTranslations } from 'next-intl';
import { useAsyncAction } from '@/hooks/ui/use-async-action';
import { deleteAccountAction, exportMyDataAction } from '@/lib/actions/account';
import { createClient } from '@/lib/supabase/client';

/**
 * The three account-level side effects — export, sign out, delete — as
 * `useAsyncAction`-backed handlers. Extracted from AccountPanel so the panel
 * stays presentational; behavior (server actions, cookie clearing, blob
 * download, redirect) is preserved verbatim.
 */
export function useAccountActions() {
  const t = useTranslations('settings.account');
  const exportAction = useAsyncAction();
  const signOutAction = useAsyncAction();
  const deleteAction = useAsyncAction();

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
        errorMessage: t('signOutError'),
        keepPendingOnSuccess: true,
      }
    );

  const handleDelete = () =>
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

  return {
    exportPending: exportAction.pending,
    signOutPending: signOutAction.pending,
    deletePending: deleteAction.pending,
    handleExport,
    handleSignOut,
    handleDelete,
  };
}
