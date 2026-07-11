'use client';

import {
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Share2,
  Sparkles,
  Users2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheatMealCard } from '@/components/logging/feed/cheat/cheat-meal-card';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import { useShareMeal } from '@/hooks/social/use-share-meal';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { MIN_DISH_GRAMS } from '@/lib/meal-utils';
import { cn } from '@/lib/utils';
import { MEAL_TEXT_MAX_LENGTH } from '@/lib/validation';

// The NL-refine is submitted as `${rawInput} (${correction})` — the joining
// " (" + ")" costs 3 chars against the analysis pipeline's message cap.
const REFINE_JOIN_CHARS = 3;
// Below this remaining budget we still allow a short correction (the feed
// truncates the original text to fit) but tell the user about the trade.
const REFINE_MIN_BUDGET = 20;

/** Per-stored-row edit the card sends up to the update mutation. */
export interface MealAmountEdit {
  edits: { id: string; newGrams: number }[];
  removeIds: string[];
}

interface PersistedMealCardProps {
  meal: PersistedMeal;
  /** Remove this meal (deferred delete with undo handled by the feed). */
  onDelete?: () => void;
  /** Re-log: prefill the composer with this meal's raw input. */
  onLogAgain?: () => void;
  /** Persist gram overrides / per-row removals; resolves when saved. */
  onUpdate?: (changes: MealAmountEdit) => Promise<void>;
  /**
   * Natural-language correction: re-run the analysis waterfall on the meal's
   * text plus this correction, replacing the meal once confirmed. Closes the
   * editor and hands off to the feed's streaming surface.
   */
  onRefine?: (correction: string) => void;
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
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
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
            : 'text-nham-text-muted/70 hover:bg-nham-hover/40 hover:text-nham-text',
          'font-sans-display'
        )}
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

export function PersistedMealCard({
  meal,
  onDelete,
  onLogAgain,
  onUpdate,
  onRefine,
}: PersistedMealCardProps) {
  // Cheat meals render a dedicated, warmly-decorated card variant; re-logging a
  // cheat occasion has its own slider-seeded path (the occasion chips), so the
  // "Log again" affordance lives only on precise meals.
  if (meal.entryMode === 'cheat') {
    return <CheatMealCard meal={meal} onDelete={onDelete} />;
  }
  return (
    <PrecisePersistedMealCard
      meal={meal}
      onDelete={onDelete}
      onLogAgain={onLogAgain}
      onUpdate={onUpdate}
      onRefine={onRefine}
    />
  );
}

/** A locally-editable row in the amount editor. */
interface EditableRow {
  id: string;
  name: string;
  grams: number | null;
  removed: boolean;
}

/**
 * Natural-language refine input — talk to fix the meal, the same way it was
 * logged. Re-runs the full analysis waterfall on the meal text plus this note,
 * replacing the meal once confirmed. Rendered both from the collapsed card's
 * "Fix with words" action and inside the amount editor.
 */
function RefineField({
  meal,
  onRefine,
  autoFocus = false,
}: {
  meal: PersistedMeal;
  onRefine: (correction: string) => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations('logging.persistedMealCard');
  const [correction, setCorrection] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount only when explicitly opened by the user (the "Fix with
  // words" action) — never steal focus when the field renders passively.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submitRefine = () => {
    const trimmed = correction.trim();
    if (trimmed.length === 0) return;
    onRefine(trimmed);
  };

  // Keep `rawInput + correction + join` within the server's message cap. When
  // the original text leaves almost no room, allow a short correction anyway —
  // the feed truncates the original to fit — and surface that quietly.
  const refineBudget =
    MEAL_TEXT_MAX_LENGTH - REFINE_JOIN_CHARS - meal.rawInput.length;
  const refineTight = refineBudget < REFINE_MIN_BUDGET;
  const refineMaxLength = Math.max(
    Math.min(200, refineBudget),
    REFINE_MIN_BUDGET
  );

  return (
    <>
      <label
        htmlFor={`refine-${meal.id}`}
        className="px-1 font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.08em]"
      >
        {t('refineLabel')}
      </label>
      <div className="mt-1.5 flex items-stretch gap-2">
        <input
          ref={inputRef}
          id={`refine-${meal.id}`}
          value={correction}
          onChange={(event) => setCorrection(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitRefine();
            }
          }}
          placeholder={t('refinePlaceholder')}
          autoComplete="off"
          maxLength={refineMaxLength}
          className="min-w-0 flex-1 rounded-lg border border-nham-border/60 bg-white px-3 py-2 font-sans-display text-[13px] text-nham-text placeholder:text-nham-text-muted/50 focus:border-nham-accent/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={submitRefine}
          disabled={correction.trim().length === 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-nham-accent/15 px-3 font-medium font-sans-display text-[12px] text-nham-text transition-colors hover:bg-nham-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t('refineSubmit')}
        </button>
      </div>
      <p className="mt-1.5 px-1 font-sans-display text-[11px] text-nham-text-muted/70">
        {refineTight ? t('refineTightHint') : t('refineHint')}
      </p>
    </>
  );
}

function MealAmountEditor({
  meal,
  onCancel,
  onSave,
  onRefine,
}: {
  meal: PersistedMeal;
  onCancel: () => void;
  onSave: (changes: MealAmountEdit) => Promise<void>;
  onRefine?: (correction: string) => void;
}) {
  const t = useTranslations('logging.persistedMealCard');
  const [isSaving, setIsSaving] = useState(false);

  // Flatten the meal's ingredient rows (each carries a stable id + grams) into
  // the editable working set. Removals and gram steps mutate local state only;
  // nothing persists until Save.
  const initialRows = useMemo<EditableRow[]>(
    () =>
      meal.mealItemGroups.flatMap((group) =>
        group.ingredients.map((ing) => ({
          id: ing.id,
          name: ing.ingredientName,
          grams: ing.estimatedGrams,
          removed: false,
        }))
      ),
    [meal.mealItemGroups]
  );
  const [rows, setRows] = useState<EditableRow[]>(initialRows);

  const remaining = rows.filter((r) => !r.removed);
  const initialById = useMemo(
    () => new Map(initialRows.map((r) => [r.id, r.grams])),
    [initialRows]
  );

  const stepGrams = (id: string, delta: number) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id && r.grams != null
          ? { ...r, grams: Math.max(MIN_DISH_GRAMS, r.grams + delta) }
          : r
      )
    );
  const toggleRemove = (id: string) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, removed: !r.removed } : r))
    );

  const handleSave = async () => {
    if (isSaving) return;
    const removeIds = rows.filter((r) => r.removed).map((r) => r.id);
    const edits = remaining.flatMap((r) => {
      const original = initialById.get(r.id);
      if (r.grams == null || original == null || r.grams === original)
        return [];
      return [{ id: r.id, newGrams: r.grams }];
    });
    if (removeIds.length === 0 && edits.length === 0) {
      onCancel();
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ edits, removeIds });
      onCancel();
    } catch {
      // Error toast is raised by the mutation; keep the editor open to retry.
      setIsSaving(false);
    }
  };

  // Removing the last row would leave an empty meal — disable Save in that case
  // (the user should remove the whole meal instead, via the Remove affordance).
  const canSave = remaining.length > 0;

  return (
    <div className="mt-5 border-nham-border border-t border-dashed pt-4">
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-[13px]',
              row.removed ? 'opacity-40' : 'bg-nham-surface/80',
              'font-sans-display'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              {row.grams != null && !row.removed && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={t('removeRow', { name: row.name })}
                    disabled={row.grams <= MIN_DISH_GRAMS}
                    onClick={() => stepGrams(row.id, -10)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-nham-border/60 bg-white text-nham-text-muted transition-colors hover:bg-nham-hover disabled:opacity-40"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="w-9 text-center font-semibold text-[11px] text-nham-text tabular-nums">
                    {Math.round(row.grams)}g
                  </span>
                  <button
                    type="button"
                    onClick={() => stepGrams(row.id, 10)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-nham-border/60 bg-white text-nham-text-muted transition-colors hover:bg-nham-hover"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
              <span
                className={cn(
                  'truncate font-medium text-nham-text',
                  row.removed && 'line-through'
                )}
              >
                {row.name}
              </span>
            </div>
            <button
              type="button"
              aria-label={t('removeRow', { name: row.name })}
              aria-pressed={row.removed}
              onClick={() => toggleRemove(row.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-nham-text-muted/70 transition-colors hover:bg-nham-danger/10 hover:text-nham-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Natural-language refine — talk to fix it, the same way you logged it. */}
      {onRefine && (
        <div className="mt-4 border-nham-border/50 border-t border-dashed pt-4">
          <RefineField meal={meal} onRefine={onRefine} />
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-full px-3 py-1.5 font-medium font-sans-display text-[12px] text-nham-text-muted/80 transition-colors hover:bg-nham-hover/40 hover:text-nham-text disabled:opacity-60"
        >
          {t('cancelEdit')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !canSave}
          aria-busy={isSaving}
          className="inline-flex items-center gap-1.5 rounded-full bg-nham-accent/15 px-3.5 py-1.5 font-medium font-sans-display text-[12px] text-nham-text transition-colors hover:bg-nham-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isSaving ? t('savingEdit') : t('saveEdit')}
        </button>
      </div>
    </div>
  );
}

function PrecisePersistedMealCard({
  meal,
  onDelete,
  onLogAgain,
  onUpdate,
  onRefine,
}: PersistedMealCardProps) {
  const t = useTranslations('logging.persistedMealCard');
  const locale = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  // "Fix with words" from the always-visible action row — opens the refine
  // input directly, without requiring expand → Edit amounts.
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  // Only meals with gram-bearing ingredient rows can be amount-edited; a
  // legacy/empty meal (no item rows) has nothing to step.
  const canEdit =
    onUpdate != null &&
    meal.mealItemGroups.some((g) =>
      g.ingredients.some((i) => i.estimatedGrams != null)
    );

  const timeLabel = new Date(meal.loggedAt).toLocaleTimeString(locale, {
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
        <span className="font-bold font-sans-display text-[11px] text-nham-text-muted/60 tracking-widest">
          {timeLabel}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
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
              className="mt-2 flex items-center justify-between font-sans-display"
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

        {/* Amount editor — replaces the read-only details while editing */}
        {isEditing && onUpdate && (
          <MealAmountEditor
            meal={meal}
            onCancel={() => setIsEditing(false)}
            onSave={onUpdate}
            onRefine={
              onRefine
                ? (correction) => {
                    setIsEditing(false);
                    onRefine(correction);
                  }
                : undefined
            }
          />
        )}

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {!isEditing && !isCollapsed && (
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
                        className="flex items-center justify-between py-2 font-sans-display text-[13px]"
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
                    <span className="font-bold font-sans-display text-[13px] text-nham-text">
                      {t('total')}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="font-sans-display text-[11px] text-nham-text-muted tabular-nums">
                        P: {protein}
                        {'  '}C: {carbs}
                        {'  '}F: {fat}
                      </span>
                      <span className="font-bold font-sans-display text-nham-text tabular-nums">
                        {calories}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Post-save actions — the correction row, never at the text input */}
        {!isEditing && (
          <div className="mt-3 flex items-center justify-between border-nham-border/40 border-t border-dashed pt-2.5">
            <div className="flex items-center gap-0.5">
              {onLogAgain && (
                <button
                  type="button"
                  onClick={onLogAgain}
                  className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
                >
                  {t('logAgain')}
                </button>
              )}
              {onRefine && (
                <button
                  type="button"
                  aria-expanded={isRefineOpen}
                  onClick={() => setIsRefineOpen((prev) => !prev)}
                  className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
                >
                  {t('refineAction')}
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRefineOpen(false);
                    setIsCollapsed(true);
                    setIsEditing(true);
                  }}
                  className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
                >
                  {t('editAmounts')}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-full px-2.5 py-1 font-medium font-sans-display text-[11px] text-nham-text-muted/70 transition-colors hover:bg-nham-danger/10 hover:text-nham-danger"
                >
                  {t('remove')}
                </button>
              )}
            </div>
            <ShareToCircleButton mealId={meal.id} share={meal.share} />
          </div>
        )}

        {/* The refine field opened from the action row — one interaction from
            the collapsed card. Also available inside the amount editor. */}
        {!isEditing && isRefineOpen && onRefine && (
          <div className="mt-3 border-nham-border/40 border-t border-dashed pt-3">
            <RefineField
              meal={meal}
              autoFocus
              onRefine={(correction) => {
                setIsRefineOpen(false);
                onRefine(correction);
              }}
            />
          </div>
        )}
      </div>
    </motion.article>
  );
}
