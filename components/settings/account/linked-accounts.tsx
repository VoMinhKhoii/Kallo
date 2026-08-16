'use client';

import type { UserIdentity } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppleLogo, GoogleLogo } from '@/components/shared/brand-logos';
import { createClient } from '@/lib/supabase/client';

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
      <p className="text-[13px] text-kallo-text-muted">{t('linkedLoading')}</p>
    );
  }

  if (isError) {
    // Fetch failed — don't render the providers as silently "unlinked"
    // (misleads the user into reconnecting). Offer an explicit retry.
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-kallo-text-muted">
          {t('linkedLoadError')}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="shrink-0 rounded-lg border border-kallo-border bg-white px-3 py-1.5 font-medium text-[13px] text-kallo-text transition-colors duration-150 hover:bg-kallo-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
        >
          {t('linkedRetry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-kallo-border">
      {OAUTH_PROVIDERS.map(({ key, label, Logo }) => {
        const identity = identities?.find((i) => i.provider === key) ?? null;
        const linked = Boolean(identity);
        const busy = pending === key;
        const isLast = total <= 1;

        return (
          <div
            key={key}
            className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <Logo className="mt-0.5 size-4 shrink-0 text-kallo-text" />
              <p className="text-[14px] text-kallo-text">{label}</p>
            </div>

            {linked ? (
              <button
                type="button"
                onClick={() => identity && handleDisconnect(identity)}
                disabled={busy || isLast}
                aria-busy={busy}
                aria-label={`${t('linkedDisconnect')} ${label}`}
                className="shrink-0 rounded-lg px-3 py-1.5 font-medium text-[13px] text-kallo-text-muted transition-colors duration-150 hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent disabled:opacity-40"
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
                className="shrink-0 rounded-lg border border-kallo-border bg-white px-3 py-1.5 font-medium text-[13px] text-kallo-text transition-colors duration-150 hover:bg-kallo-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent disabled:opacity-60"
              >
                {t('linkedConnect')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
