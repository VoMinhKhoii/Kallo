'use client';

import type { UserIdentity } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  GHOST_BUTTON,
  SECONDARY_BUTTON,
} from '@/components/settings/chrome/controls';
import { SettingsRow } from '@/components/settings/chrome/group';
import { AppleLogo, GoogleLogo } from '@/components/shared/brand-logos';
import { createClient } from '@/lib/infra/supabase/client';

/**
 * Linked sign-in methods: connect Google / Apple to the current account, or
 * disconnect them. This is the safe, deliberate path to "log in with any
 * method" — the user is already authenticated, so linking can't be used to take
 * over an account (unlike silent same-email auto-merge).
 *
 * The last remaining identity can't be removed (it would lock the user out).
 */
const OAUTH_PROVIDERS = [
  { key: 'google', label: 'Google', Logo: GoogleLogo },
  { key: 'apple', label: 'Apple', Logo: AppleLogo },
] as const;

type OAuthProviderKey = (typeof OAUTH_PROVIDERS)[number]['key'];

export function LinkedAccounts() {
  const t = useTranslations('settings.account');
  const locale = useLocale();
  const {
    data: identities,
    isPending: identitiesLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['user-identities'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data?.identities ?? [];
    },
  });
  const [pending, setPending] = useState<string | null>(null);

  const handleConnect = async (provider: OAuthProviderKey) => {
    if (pending !== null) return;
    setPending(provider);
    const supabase = createClient();
    const next = `/${locale}/settings`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo },
    });
    // Success redirects the browser to the provider; only surface failures.
    if (error) {
      console.error('[linked-accounts] linkIdentity failed', error);
      setPending(null);
      toast.error(t('linkedConnectError'));
    }
  };

  const handleDisconnect = async (identity: UserIdentity) => {
    if (pending !== null || (identities?.length ?? 0) <= 1) return;
    setPending(identity.provider);
    const supabase = createClient();
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) {
      console.error('[linked-accounts] unlinkIdentity failed', error);
      setPending(null);
      toast.error(t('linkedDisconnectError'));
      return;
    }
    await refetch();
    setPending(null);
  };

  const total = identities?.length ?? 0;

  if (identitiesLoading) {
    // Until identities resolve we don't know what's linked — show a
    // placeholder rather than rendering every provider as "Connect".
    return (
      <p className="py-4 text-[13px] text-kallo-text-muted">
        {t('linkedLoading')}
      </p>
    );
  }

  if (isError) {
    // Fetch failed — don't render the providers as silently "unlinked"
    // (misleads the user into reconnecting). Offer an explicit retry.
    return (
      <div className="flex min-h-[52px] items-center justify-between gap-4 py-2.5">
        <p className="text-[13px] text-kallo-text-muted">
          {t('linkedLoadError')}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className={SECONDARY_BUTTON}
        >
          {t('linkedRetry')}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label={t('linkedTitle')}
      className="flex flex-col divide-y divide-kallo-border"
    >
      {OAUTH_PROVIDERS.map(({ key, label, Logo }) => {
        const identity = identities?.find((i) => i.provider === key) ?? null;
        const linked = Boolean(identity);
        const busy = pending === key;
        const isLast = total <= 1;

        return (
          <SettingsRow
            key={key}
            label={
              <span className="flex items-center gap-2.5">
                <Logo className="size-4 shrink-0 text-kallo-text" />
                {label}
              </span>
            }
          >
            {linked ? (
              <button
                type="button"
                onClick={() => identity && handleDisconnect(identity)}
                disabled={busy || isLast}
                aria-busy={busy}
                aria-label={`${t('linkedDisconnect')} ${label}`}
                className={GHOST_BUTTON}
              >
                {t('linkedDisconnect')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConnect(key)}
                disabled={busy || identitiesLoading}
                aria-busy={busy}
                aria-label={`${t('linkedConnect')} ${label}`}
                className={SECONDARY_BUTTON}
              >
                {t('linkedConnect')}
              </button>
            )}
          </SettingsRow>
        );
      })}
    </section>
  );
}
