'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SettingsGroup, SettingsRow } from '@/components/settings/chrome/group';
import { RowButton } from '@/components/settings/chrome/row-button';
import { useEntitlements } from '@/hooks/billing/use-entitlements';
import { DangerZone } from './danger-zone';
import { LinkedAccounts } from './linked-accounts';
import { useAccountActions } from './use-account-actions';

/**
 * Account settings: sign-in identity, linked methods, sign out, and permanent
 * account deletion — four groups split by space, not titles. Data export
 * lives on the Privacy page.
 *
 * Deletion lives in its own group: a red button that opens the shared
 * confirm dialog with a typed check. Sign out lives here as well as in the
 * user menu so the settings area is self-sufficient.
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
    <div className="flex flex-col gap-6 font-sans-display">
      {email && (
        <SettingsGroup>
          <SettingsRow label={t('emailLabel')}>
            <p className="text-[14px] text-kallo-text-muted">{email}</p>
          </SettingsRow>
        </SettingsGroup>
      )}

      <LinkedAccounts />

      <SettingsGroup>
        <SettingsRow label={t('signOutTitle')}>
          <RowButton
            pending={signOutPending}
            onClick={handleSignOut}
            icon={<LogOut className="h-3.5 w-3.5" />}
          >
            {t('signOutAction')}
          </RowButton>
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
