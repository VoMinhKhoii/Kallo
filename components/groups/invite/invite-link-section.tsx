'use client';

import { Check, Copy, Link2, Loader2, Pencil, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useMyProfile, useSaveProfile } from '@/hooks/profile/use-profile';
import { ApiError } from '@/lib/errors';
import { HANDLE_MIN_LENGTH, validateHandle } from '@/lib/groups/handles';
import { DisplayNameRow } from './display-name-row';

/**
 * The signed-in user's shareable invite link. The profile (and its slug) is
 * auto-provisioned server-side, so there is no claim step — the link is ready
 * immediately. The end of the link is editable (rename via upsertPublicProfile).
 */
export function InviteLinkSection() {
  const t = useTranslations('groups.invite');
  const locale = useLocale();
  const { data: profile, isLoading } = useMyProfile();
  const saveProfile = useSaveProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (isLoading || !profile) {
    return (
      <div className="h-[84px] animate-pulse rounded-xl bg-nham-hover/50" />
    );
  }

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const inviteLink = `${origin}/${locale}/invite/${profile.handle}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyError'));
    }
  };

  if (editing) {
    const normalized = draft.trim().toLowerCase().replace(/^@+/, '');
    const validation =
      normalized.length === 0 ? null : validateHandle(normalized);
    const canSave =
      validation?.valid === true &&
      normalized !== profile.handle &&
      !saveProfile.isPending;

    let issue = '';
    if (
      validation &&
      !validation.valid &&
      normalized.length >= HANDLE_MIN_LENGTH
    ) {
      issue =
        validation.error === 'reserved' ? t('endReserved') : t('endInvalid');
    }

    const save = () => {
      if (!canSave) return;
      saveProfile.mutate(
        { handle: normalized },
        {
          onSuccess: () => {
            setEditing(false);
            toast.success(t('endSaved'));
          },
          onError: (error) => {
            const code = error instanceof ApiError ? error.code : null;
            toast.error(code === 'CONFLICT' ? t('endTaken') : t('endError'));
          },
        }
      );
    };

    return (
      <div className="space-y-2 rounded-xl border border-nham-accent/40 bg-nham-accent/[0.06] p-3">
        <p className="font-medium font-sans-display text-[13px] text-nham-text">
          {t('editTitle')}
        </p>
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-sans-display text-[12px] text-nham-text-muted/70">
              …/invite/
            </span>
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  save();
                }
              }}
              aria-label={t('editTitle')}
              aria-invalid={Boolean(issue)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              className="border-nham-border/60 bg-white pl-[68px] font-sans-display text-nham-text"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            aria-label={t('save')}
            className="inline-flex shrink-0 items-center rounded-lg bg-nham-btn px-3 font-medium text-white transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveProfile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label={t('cancel')}
            className="inline-flex shrink-0 items-center rounded-lg border border-nham-border/60 px-3 text-nham-text-muted transition-colors hover:bg-nham-hover/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p
          aria-live="polite"
          className={`text-[11px] ${issue ? 'text-nham-danger' : 'text-nham-text-muted'} font-sans-display`}
        >
          {issue || t('editHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DisplayNameRow profile={profile} />
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 px-1 font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.08em]">
          <Link2 className="h-3.5 w-3.5" />
          {t('yourLink')}
        </p>
        <div className="flex items-stretch gap-2">
          <Input
            readOnly
            value={inviteLink}
            onFocus={(event) => event.currentTarget.select()}
            aria-label={t('yourLink')}
            className="flex-1 border-nham-border/60 bg-white font-sans-display text-[12px] text-nham-text-muted"
          />
          <button
            type="button"
            onClick={() => {
              setDraft(profile.handle);
              setEditing(true);
            }}
            aria-label={t('editTitle')}
            className="inline-flex shrink-0 items-center rounded-lg border border-nham-border/60 bg-white px-3 text-nham-text-muted transition-colors hover:border-nham-accent/50 hover:text-nham-text"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-nham-border/60 bg-white px-3.5 font-medium font-sans-display text-[12px] text-nham-text transition-colors hover:border-nham-accent/50"
          >
            <Copy className="h-3.5 w-3.5" />
            {t('copy')}
          </button>
        </div>
        <p className="px-1 font-sans-display text-[11px] text-nham-text-muted/70">
          {t('hint')}
        </p>
      </div>
    </div>
  );
}
