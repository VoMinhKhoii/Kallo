'use client';

import { Loader2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { toast } from 'sonner';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useRemoveAvatar, useUploadAvatar } from '@/hooks/profile/use-profile';
import type { PublicProfile } from '@/lib/groups/client';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/uploads/image-file';

const BUTTON_CLASS =
  'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-nham-border bg-nham-surface px-3.5 py-2 font-medium text-[13px] text-nham-text transition-colors duration-150 hover:bg-nham-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent disabled:opacity-60';

/** Avatar preview with upload/remove — the photo half of the identity panel. */
export function AvatarField({ profile }: { profile: PublicProfile }) {
  const t = useTranslations('settings.identity');
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const busy = upload.isPending || remove.isPending;

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-picking the same file after an error.
    event.target.value = '';
    if (!file || busy) return;
    if (!IMAGE_TYPES[file.type]) {
      toast.error(t('avatarType'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t('avatarTooLarge'));
      return;
    }
    upload.mutate(file, {
      onSuccess: () => toast.success(t('avatarSaved')),
      onError: () => toast.error(t('avatarError')),
    });
  };

  const handleRemove = () => {
    if (busy) return;
    remove.mutate(undefined, {
      onSuccess: () => toast.success(t('avatarRemoved')),
      onError: () => toast.error(t('avatarError')),
    });
  };

  return (
    <div className="flex items-center gap-4">
      <ProfileAvatar
        avatarUrl={profile.avatarUrl}
        label={profile.displayName?.trim() || profile.handle}
        className="size-16 text-[22px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handlePick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-busy={upload.isPending}
          className={BUTTON_CLASS}
        >
          {upload.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {profile.hasCustomAvatar ? t('avatarChange') : t('avatarUpload')}
        </button>
        {profile.hasCustomAvatar && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            aria-busy={remove.isPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 font-medium text-[13px] text-nham-text-muted transition-colors duration-150 hover:bg-nham-hover/40 hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent disabled:opacity-60"
          >
            {remove.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            {t('avatarRemove')}
          </button>
        )}
      </div>
    </div>
  );
}
