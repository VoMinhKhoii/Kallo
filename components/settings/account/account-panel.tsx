'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SettingsGroup, SettingsRow } from '@/components/settings/chrome/group';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { DangerZone } from './danger-zone';
import { LinkedAccounts } from './linked-accounts';
import { ROW_BUTTON } from './row-button';
import { useAccountActions } from './use-account-actions';

/**
 * Account settings: sign-in identity, linked methods, sign out, and permanent
 * account deletion — as two grouped list-cards (Apple Settings idiom) rather
 * than a stack of individual cards. Data export lives on the Privacy page.
 *
 * Deletion lives in its own danger-variant group as an inline, type-to-confirm
 * panel (not a modal-first flow) in the brand's calm "concern" register —
 * terracotta `kallo-danger`, never the cold shadcn `destructive`. Sign out lives
 * here as well as in the user menu so the settings area is self-sufficient.
 */
export function AccountPanel({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}) {
  const t = useTranslations('settings.account');
  const { signOutPending, deletePending, handleSignOut, handleDelete } =
    useAccountActions(userId);
  const { data: entitlements } = useEntitlements(userId);

  return (
    <div className="font-sans-display">
      <SettingsGroup>
        {email && (
          <SettingsRow label={t('emailLabel')}>
            <p className="text-[15px] text-kallo-text-muted">{email}</p>
          </SettingsRow>
        )}

        <SettingsRow label={t('linkedTitle')} layout="stacked">
          <LinkedAccounts />
        </SettingsRow>

        <SettingsRow label={t('signOutTitle')}>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signOutPending}
            aria-busy={signOutPending}
            className={ROW_BUTTON}
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('signOutAction')}
          </button>
        </SettingsRow>
      </SettingsGroup>

      <DangerZone
        onDelete={handleDelete}
        deleting={deletePending}
        managementUrl={entitlements?.managementUrl ?? null}
      />
    </div>
  );
}
