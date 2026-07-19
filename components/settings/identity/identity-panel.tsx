'use client';

import { Check, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMyProfile, useRenameProfile } from '@/hooks/profile/use-profile';
import { AvatarField } from './avatar-field';

const DISPLAY_NAME_MAX = 50;

/**
 * Identity settings: avatar photo + "what should we call you". Renaming
 * re-derives the invite handle server-side, so the panel previews the
 * resulting link and warns that old links stop working.
 */
export function IdentityPanel() {
  const t = useTranslations('settings.identity');
  const locale = useLocale();
  const { data: profile, isPending } = useMyProfile();
  const rename = useRenameProfile();
  // null = untouched (mirror the saved name); string = user's draft.
  const [draft, setDraft] = useState<string | null>(null);

  if (isPending || !profile) {
    return (
      <div className="animate-pulse rounded-2xl border border-nham-border/70 bg-white px-4 py-5">
        <div className="flex items-center gap-4">
          <span className="size-16 rounded-full bg-nham-border/40" />
          <span className="h-4 w-40 rounded-full bg-nham-border/40" />
        </div>
      </div>
    );
  }

  const saved = profile.displayName ?? '';
  const value = draft ?? saved;
  const dirty = value.trim() !== saved && value.trim().length > 0;

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const inviteLink = `${origin}/${locale}/invite/${profile.handle}`;

  const handleSave = () => {
    if (!dirty || rename.isPending) return;
    rename.mutate(value.trim(), {
      onSuccess: () => {
        setDraft(null);
        toast.success(t('nameSaved'));
      },
      onError: () => toast.error(t('nameError')),
    });
  };

  return (
    <div className="flex flex-col gap-3 font-sans-display">
      <div className="rounded-2xl border border-nham-border/70 bg-white px-4 py-4">
        <p className="mb-3 text-[11px] text-nham-text-muted uppercase tracking-[0.14em]">
          {t('avatarLabel')}
        </p>
        <AvatarField profile={profile} />
      </div>

      <div className="rounded-2xl border border-nham-border/70 bg-white px-4 py-4">
        <label className="block">
          <span className="text-[15px] text-nham-text">{t('nameLabel')}</span>
          <div className="mt-2 flex items-stretch gap-2">
            <input
              type="text"
              value={value}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSave();
                }
              }}
              placeholder={t('namePlaceholder')}
              autoComplete="off"
              maxLength={DISPLAY_NAME_MAX}
              className="w-full max-w-sm rounded-xl border border-nham-border bg-nham-surface px-3.5 py-2.5 text-[15px] text-nham-text outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-nham-accent/40"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || rename.isPending}
              aria-busy={rename.isPending}
              aria-label={t('nameSave')}
              className="inline-flex shrink-0 items-center rounded-xl bg-nham-btn px-3.5 font-medium text-white transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rename.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
          </div>
        </label>

        <p className="mt-3 text-[12px] text-nham-text-muted">
          {t('linkPreview')}{' '}
          <span className="break-all text-nham-text">{inviteLink}</span>
        </p>
        <p className="mt-1 text-[12px] text-nham-text-muted">
          {t('linkWarning')}
        </p>
      </div>
    </div>
  );
}
