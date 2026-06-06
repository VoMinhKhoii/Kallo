'use client';

import { ChevronDown, Loader2, Share2, Users2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { CheatMealCard } from '@/components/logging/feed/cheat-meal-card';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import { useShareMeal } from '@/hooks/use-share-meal';
import type { PersistedMeal } from '@/lib/actions/meals';
import { cn } from '@/lib/utils';

interface PersistedMealCardProps {
  meal: PersistedMeal;
}

function ShareCardButton({ shareId }: { shareId: string }) {
  const t = useTranslations('groups.shareControl');

  const handleShare = async () => {
    const url = `${window.location.origin}/api/og/macro-card/${shareId}`;
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({ title: t('shareCardTitle'), url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('copiedLink'));
    } catch {
      toast.error(t('errorCopy'));
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <Share2 className="h-3.5 w-3.5" />
      {t('shareCard')}
    </button>
  );
}

function ShareToCircleButton({
  mealId,
  share,
}: {
  mealId: string;
  share: PersistedMeal['share'];
}) {
  const t = useTranslations('groups.shareControl');
  const shareMeal = useShareMeal();
  const [isShared, setIsShared] = useState(
    share != null && share.visibility !== 'private'
  );
  const [shareId, setShareId] = useState<string | null>(
    share && share.visibility !== 'private' ? share.shareId : null
  );

  const handleToggle = () => {
    if (shareMeal.isPending) return;
    const next = isShared ? 'private' : 'circle';
    shareMeal.mutate(
      { mealId, visibility: next },
      {
        onSuccess: (data) => {
          setIsShared(next === 'circle');
          setShareId(next === 'circle' ? data.shareId : null);
        },
        onError: () =>
          toast.error(next === 'circle' ? t('errorShare') : t('errorUnshare')),
      }
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      {isShared && shareId && <ShareCardButton shareId={shareId} />}
      <button
        type="button"
        onClick={handleToggle}
        disabled={shareMeal.isPending}
        aria-pressed={isShared}
        aria-busy={shareMeal.isPending}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          isShared
            ? 'bg-nham-accent/15 text-nham-text'
            : 'text-nham-text-muted/70 hover:bg-nham-hover/40 hover:text-nham-text'
        )}
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {shareMeal.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Users2 className="h-3.5 w-3.5" />
        )}
        {shareMeal.isPending
          ? t('sharing')
          : isShared
            ? t('shared')
            : t('share')}
      </button>
    </div>
  );
}

export function PersistedMealCard({ meal }: PersistedMealCardProps) {
  // Cheat meals render a dedicated, warmly-decorated card variant.
  if (meal.entryMode === 'cheat') {
    return <CheatMealCard meal={meal} />;
  }
  return <PrecisePersistedMealCard meal={meal} />;
}

function PrecisePersistedMealCard({ meal }: PersistedMealCardProps) {
  const t = useTranslations('logging.persistedMealCard');
  const [isCollapsed, setIsCollapsed] = useState(true);

  const timeLabel = new Date(meal.loggedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const calories = formatCaloriesOrNA(meal.nutrition.caloriesKcal);
  const protein = formatMacroOrNA(meal.nutrition.proteinG);
  const carbs = formatMacroOrNA(meal.nutrition.carbohydrateG);
  const fat = formatMacroOrNA(meal.nutrition.fatG);

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="group relative"
    >
      {/* Timeline dot & line */}
      <div className="absolute top-2 bottom-0 -left-4 w-px bg-nham-border/60 group-last:bg-transparent sm:-left-10" />
      <div className="absolute top-2 -left-5 h-2 w-2 rounded-full border-2 border-nham-accent bg-white sm:-left-[43px]" />

      {/* Time label */}
      <div className="mb-2">
        <span
          className="font-bold text-[11px] text-nham-text-muted/60 tracking-widest"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {timeLabel}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[17px] text-nham-text leading-relaxed sm:text-[19px]"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {meal.rawInput}
          </p>
          <button
            type="button"
            aria-label={t('toggleDetails')}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="rounded-full p-1 text-nham-text-muted/60 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {/* Collapsed summary */}
        <AnimatePresence initial={false}>
          {isCollapsed && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-2 flex items-center justify-between"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <span className="text-[11px] text-nham-text-muted tabular-nums">
                P: {protein}
                {'  '}C: {carbs}
                {'  '}F: {fat}
              </span>
              <span className="font-bold text-nham-text text-sm tabular-nums">
                {calories}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mt-5 border-nham-border border-t border-dashed pt-4">
                <div className="mb-4 space-y-1">
                  {meal.mealItemGroups.map((group) => {
                    const gProtein = formatMacroOrNA(group.nutrition.proteinG);
                    const gCarbs = formatMacroOrNA(
                      group.nutrition.carbohydrateG
                    );
                    const gFat = formatMacroOrNA(group.nutrition.fatG);
                    const gCal = formatCaloriesOrNA(
                      group.nutrition.caloriesKcal
                    );
                    return (
                      <div
                        key={`${group.order}-${group.name}`}
                        className="flex items-center justify-between py-2 text-[13px]"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        <span className="min-w-0 truncate font-medium text-nham-text">
                          {group.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="flex gap-2 text-[10px] text-nham-text-muted tabular-nums">
                            <span className="text-right">P:{gProtein}</span>
                            <span className="text-right">C:{gCarbs}</span>
                            <span className="text-right">F:{gFat}</span>
                          </div>
                          <span className="text-right font-bold text-nham-text tabular-nums">
                            {gCal}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="border-nham-border/50 border-t border-dashed pt-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-[13px] text-nham-text"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {t('total')}
                    </span>
                    <div className="flex items-center gap-4">
                      <span
                        className="text-[11px] text-nham-text-muted tabular-nums"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        P: {protein}
                        {'  '}C: {carbs}
                        {'  '}F: {fat}
                      </span>
                      <span
                        className="font-bold text-nham-text tabular-nums"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        {calories}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Post-save share affordance — never at the text input */}
        <div className="mt-3 flex justify-end border-nham-border/40 border-t border-dashed pt-2.5">
          <ShareToCircleButton mealId={meal.id} share={meal.share} />
        </div>
      </div>
    </motion.article>
  );
}
