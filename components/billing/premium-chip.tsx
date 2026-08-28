'use client';

import { useTranslations } from 'next-intl';
import { HIGHLIGHT_BADGE } from '@/components/landing-page/highlight';
import { cn } from '@/lib/core/ui/cn';

/**
 * The "Premium" pill worn by a gated entry point. Same marker ink as the
 * landing pricing card's savings badge — see the docblock in `highlight.ts`
 * for why this is the one sanctioned reuse of that colour.
 */
export function PremiumChip({ className }: { className?: string }) {
  const t = useTranslations('billing');
  return (
    <span className={cn(HIGHLIGHT_BADGE, className)}>{t('premium.chip')}</span>
  );
}
