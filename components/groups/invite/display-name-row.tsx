'use client';

import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useRenameProfile, useSaveProfile } from '@/hooks/profile/use-profile';
import type { PublicProfile } from '@/lib/groups/client';

const DISPLAY_NAME_MAX = 50;

/**
 * "How you appear" — the display name your circle sees on shared meals. A
 * rename goes through the rename endpoint, which re-derives the invite handle
 * from the name (same behavior as the settings identity panel). An empty
 * draft clears the name back to the handle fallback without touching the
 * handle.
 */
export function DisplayNameRow({ profile }: { profile: PublicProfile }) {
  const t = useTranslations('groups.invite');
  const saveProfile = useSaveProfile();
  const renameProfile = useRenameProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const current = profile.displayName?.trim() ?? '';
  const pending = saveProfile.isPending || renameProfile.isPending;

  const save = () => {
    if (pending) return;
    const next = draft.trim();
    if (next === current) {
      setEditing(false);
      return;
    }
    const callbacks = {
      onSuccess: () => {
        setEditing(false);
        toast.success(t('appearSaved'));
      },
      onError: () => toast.error(t('appearError')),
    };
    if (next.length > 0) {
      renameProfile.mutate(next, callbacks);
    } else {
      // Clearing has no name to derive a handle from — keep the handle and
      // null the stored name via the upsert (it requires the handle to ride
      // along).
      saveProfile.mutate(
        { handle: profile.handle, displayName: null },
        callbacks
      );
    }
  };

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl border border-nham-accent/40 bg-nham-accent/[0.06] p-3">
        <p className="font-medium font-sans-display text-[13px] text-nham-text">
          {t('appearTitle')}
        </p>
        <div className="flex items-stretch gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            aria-label={t('appearTitle')}
            placeholder={t('appearPlaceholder')}
            autoComplete="off"
            maxLength={DISPLAY_NAME_MAX}
            className="flex-1 border-nham-border/60 bg-white font-sans-display text-nham-text"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            aria-label={t('save')}
            className="inline-flex shrink-0 items-center rounded-lg bg-nham-btn px-3 font-medium text-white transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
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
        <p className="font-sans-display text-[11px] text-nham-text-muted">
          {t('appearHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="px-1 font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.08em]">
        {t('appearTitle')}
      </p>
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-nham-border/60 bg-white px-3 font-sans-display text-[13px]">
          {current ? (
            <span className="truncate text-nham-text">{current}</span>
          ) : (
            <span className="truncate text-nham-text-muted/70">
              {t('appearFallback')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(current);
            setEditing(true);
          }}
          aria-label={t('appearEdit')}
          className="inline-flex shrink-0 items-center rounded-lg border border-nham-border/60 bg-white px-3 text-nham-text-muted transition-colors hover:border-nham-accent/50 hover:text-nham-text"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
