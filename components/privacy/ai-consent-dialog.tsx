'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * The one-time ask before Kallo first sends anything to the third-party AI
 * (App Store 5.1.2(i)): who receives what, that it is not used for training,
 * and where to read more. "Continue" records consent; "Not now" sends nothing.
 *
 * Controlled and presentational — `AiConsentProvider` owns when it opens and
 * what the answer does.
 */
export function AiConsentDialog({
  open,
  isSaving,
  onContinue,
  onNotNow,
}: {
  open: boolean;
  isSaving: boolean;
  onContinue: () => void;
  onNotNow: () => void;
}) {
  const t = useTranslations('common.aiConsent');

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSaving) onNotNow();
      }}
    >
      <AlertDialogContent className="border-kallo-border bg-card text-kallo-text">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-normal font-serif text-[20px]">
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 font-sans-display text-[14px] text-kallo-text-muted leading-relaxed">
            <span className="block">{t('body')}</span>
            <span className="block">{t('training')}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Link
          href="/docs/legal/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit font-sans-display text-[13px] text-kallo-text underline underline-offset-4 hover:text-kallo-text-muted"
        >
          {t('privacyLink')}
        </Link>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>
            {t('notNow')}
          </AlertDialogCancel>
          {/* A plain button, not AlertDialogAction: the action closes the
              dialog on click, and it must stay open until the write lands. */}
          <Button onClick={onContinue} disabled={isSaving} aria-busy={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('continue')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
