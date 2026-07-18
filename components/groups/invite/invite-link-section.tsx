'use client';

import { Check, Copy, Link2, Loader2, Pencil, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useMyProfile, useSaveProfile } from '@/hooks/profile/use-profile';
import { ApiError } from '@/lib/errors';
import { HANDLE_MIN_LENGTH, validateHandle } from '@/lib/groups/handles';

/**
 * The signed-in user's shareable invite link. The profile (and its slug) is
 * auto-provisioned server-side, so there is no claim step — the link is ready
 * immediately. Only the end (the handle) is editable, in place: the link field
 * turns into the handle editor and the pencil/copy pair becomes save/cancel.
 */
export function InviteLinkSection() {
  const t = useTranslations('groups.invite');
  const locale = useLocale();
  const { data: profile, isLoading } = useMyProfile();
  const saveProfile = useSaveProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  if (isLoading || !profile) {
    return (
      <div className="h-[76px] animate-pulse rounded-xl bg-[#E8E6DC]/50" />
    );
  }

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const inviteLink = `${origin}/${locale}/invite/${profile.handle}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('linkCopyError'));
    }
  };

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

  const startEdit = () => {
    setDraft(profile.handle);
    setEditing(true);
  };

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 px-1 font-medium font-sans-display text-[#6E6D66] text-[10px] uppercase tracking-[0.08em]">
        <Link2 className="h-3.5 w-3.5" />
        {t('yourLink')}
      </p>

      <div className="flex items-stretch gap-2">
        {editing ? (
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-sans-display text-[#6E6D66] text-[13px]">
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
                if (event.key === 'Escape') setEditing(false);
              }}
              aria-label={t('editTitle')}
              aria-invalid={Boolean(issue)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              className="border-[#E8E6DC] bg-white pl-[70px] font-sans-display text-[#141413] text-[13px]"
            />
          </div>
        ) : (
          <Input
            readOnly
            value={inviteLink}
            onFocus={(event) => event.currentTarget.select()}
            aria-label={t('yourLink')}
            className="flex-1 border-[#E8E6DC] bg-white font-sans-display text-[#141413] text-[13px]"
          />
        )}

        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              aria-label={t('save')}
              className="inline-flex shrink-0 items-center rounded-lg bg-nham-btn px-3 text-white transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="inline-flex shrink-0 items-center rounded-lg border border-[#E8E6DC] bg-white px-3 text-[#6E6D66] transition-colors hover:text-[#141413]"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startEdit}
              aria-label={t('editLink')}
              className="inline-flex shrink-0 items-center rounded-lg border border-[#E8E6DC] bg-white px-3 text-[#6E6D66] transition-colors hover:text-[#141413]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-nham-btn px-4 font-medium font-sans-display text-[13px] text-white transition-colors hover:bg-nham-btn/90"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {t('copied')}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {t('copy')}
                </>
              )}
            </button>
          </>
        )}
      </div>

      <p
        aria-live="polite"
        className={`px-1 font-sans-display text-[11px] ${issue ? 'text-nham-danger' : 'text-[#6E6D66]'}`}
      >
        {editing ? issue || t('editHint') : t('hint')}
      </p>
    </div>
  );
}
