'use client';

import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useSaveProfile } from '@/hooks/profile/use-profile';
import type { PublicProfile } from '@/lib/groups/client';

const DISPLAY_NAME_MAX = 50;

/**
 * "How you appear" — the display name your circle sees on shared meals. Persists
 * through the same profile upsert as the link slug, so the current handle rides
 * along (the upsert requires it). An empty draft clears the name back to the
 * handle fallback.
 */
export function DisplayNameRow({ profile }: { profile: PublicProfile }) {
  const t = useTranslations('groups.invite');
  const saveProfile = useSaveProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const current = profile.displayName?.trim() ?? '';

  const save = () => {
    if (saveProfile.isPending) return;
    const next = draft.trim();
    if (next === current) {
      setEditing(false);
      return;
    }
    saveProfile.mutate(
      // Empty draft clears the name (undefined → null server-side); the handle
      // always rides along because the upsert requires it.
      {
        handle: profile.handle,
        displayName: next.length > 0 ? next : undefined,
      },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success(t('appearSaved'));
        },
        onError: () => toast.error(t('appearError')),
      }
    );
  };

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl border border-nham-accent/40 bg-nham-accent/[0.06] p-3">
        <p
          className="font-medium text-[13px] text-nham-text"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
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
            className="flex-1 border-nham-border/60 bg-white text-nham-text"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          />
          <button
            type="button"
            onClick={save}
            disabled={saveProfile.isPending}
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
          className="text-[11px] text-nham-text-muted"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('appearHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p
        className="px-1 font-medium text-[10px] text-nham-text-muted uppercase tracking-[0.08em]"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {t('appearTitle')}
      </p>
      <div className="flex items-stretch gap-2">
        <div
          className="flex flex-1 items-center rounded-lg border border-nham-border/60 bg-white px-3 text-[13px]"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
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
