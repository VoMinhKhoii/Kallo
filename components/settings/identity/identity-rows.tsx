'use client';

import { Check, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { SettingsRow } from '@/components/settings/group';
import { useMyProfile, useRenameProfile } from '@/hooks/profile/use-profile';
import { AvatarField } from './avatar-field';

const DISPLAY_NAME_MAX = 50;

/**
 * Identity rows: avatar photo + "what should we call you", as hairline-divided
 * rows inside the Profile group (no card wrappers of their own). Renaming
 * re-derives the invite handle server-side, so the name row previews the
 * resulting link and warns that old links stop working.
 */
export function IdentityRows() {
  const t = useTranslations('settings.identity');
  const locale = useLocale();
  const { data: profile, isPending } = useMyProfile();
  const rename = useRenameProfile();
  // null = untouched (mirror the saved name); string = user's draft.
  const [draft, setDraft] = useState<string | null>(null);

  if (isPending || !profile) {
    return (
      <>
        <div className="p-card-sm">
          <div className="h-4 w-40 rounded-full bg-nham-track motion-safe:animate-pulse" />
        </div>
        <div className="p-card-sm">
          <div className="h-4 w-48 rounded-full bg-nham-track motion-safe:animate-pulse" />
        </div>
      </>
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
      onError: (error) => {
        console.error('[identity-rows] rename failed', error);
        toast.error(t('nameError'));
      },
    });
  };

  return (
    <>
      <SettingsRow label={t('avatarLabel')}>
        <AvatarField profile={profile} />
      </SettingsRow>

      <SettingsRow
        label={t('nameLabel')}
        htmlFor="identity-display-name"
        description={
          <>
            {t('linkPreview')}{' '}
            <span className="break-all text-nham-text">{inviteLink}</span>
            <span className="mt-1 block">{t('linkWarning')}</span>
          </>
        }
      >
        <div className="flex w-full items-stretch gap-2 sm:w-auto">
          <input
            id="identity-display-name"
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
            className="w-full rounded-xl border border-nham-border bg-white px-3.5 py-2.5 text-[15px] text-nham-text outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-nham-accent/40 sm:w-64"
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
      </SettingsRow>
    </>
  );
}
