'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { SettingsRow } from '@/components/settings/chrome/group';

/**
 * The invite link as its own row under the name it is derived from, with a
 * copy button. Renaming re-derives the link, hence the warning beneath.
 */
export function InviteLinkRow({ link }: { link: string }) {
  const t = useTranslations('settings.identity');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t('linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('linkCopyError'));
    }
  };

  return (
    <SettingsRow label={t('inviteLabel')} description={t('linkWarning')}>
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:max-w-[60%]">
        <span className="min-w-0 flex-1 truncate text-[14px] text-kallo-text-muted">
          {link}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={t('linkCopy')}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-kallo-text-muted transition-colors hover:bg-kallo-hover hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </SettingsRow>
  );
}
