'use client';

import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Drawer as VaulDrawer } from 'vaul';
import { DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import {
  initialManualGrams,
  type ManualSheetItem,
  mealKcalWith,
  sheetItemsAsRows,
} from '@/lib/domain/logging/manual-display';
import {
  formatKcal,
  type IngredientSearchResult,
  isManualMealFull,
  totalsForRows,
} from '@/lib/domain/logging/manual-logging';
import { ManualFoodPage } from './manual-food-page';
import { ManualSearchPage } from './manual-search-page';
import type { ManualSheetState } from './use-manual-sheet';

/** How much of the meal sheet's strip shows above this one. */
const PEEK = 26;

/** A page slides a full width: in from the side it travels toward. */
const PAGE = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%' }),
};

/**
 * The second sheet, stacked over the meal (a vaul nested drawer): search, a
 * food's page, then back to search with the food marked as added — one surface
 * whose content pages, under a strip of the meal sheet that keeps the running
 * total in view. Mount it with a fresh `key` per open: the query, the page and
 * its grams belong to one visit. Mirrors the Flutter `ManualAddSheet`.
 */
export function ManualAddSheet({
  open,
  onOpenChange,
  meal,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: ManualSheetState;
  /** Opens straight onto this item's page; leaving the page closes the sheet. */
  editing: ManualSheetItem | null;
}) {
  const t = useTranslations('logging.manualLogging');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<{
    food: IngredientSearchResult;
    itemId: string | null;
  } | null>(editing ? { food: editing.ingredient, itemId: editing.id } : null);
  const [grams, setGrams] = useState(editing?.grams ?? 100);
  const [addedAny, setAddedAny] = useState(false);
  const [visited, setVisited] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const close = () => onOpenChange(false);

  const pick = (food: IngredientSearchResult) => {
    const item = meal.itemFor(food.id);
    setPage({ food, itemId: item?.id ?? null });
    setGrams(item?.grams ?? initialManualGrams(food));
    setVisited(true);
  };
  const leave = () => (editing ? close() : setPage(null));

  const full = isManualMealFull(meal.items.length);
  // Unknown calories read "—"; only an empty plate is a known 0.
  const total =
    totalsForRows(sheetItemsAsRows(meal.items)).caloriesKcal ??
    (meal.items.length ? null : 0);
  const summary = t('peek', {
    count: t('ingredientCount', { count: meal.items.length }),
    kcal: formatKcal(total),
  });
  // Nothing to promise for a food with no calorie figure, or a new food that
  // a full plate cannot take.
  const promises =
    page !== null &&
    page.food.per100g.caloriesKcal != null &&
    !(full && page.itemId === null);
  const after = promises
    ? formatKcal(
        mealKcalWith(meal.items, page.food, grams, page.itemId ?? undefined)
      )
    : null;
  const peekAfter =
    page && after !== null && !(page.itemId && after === formatKcal(total))
      ? t(page.itemId ? 'peekAfter' : 'peekWith', { kcal: after })
      : null;

  return (
    <VaulDrawer.NestedRoot open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        aria-describedby={undefined}
        // The search's own autoFocus lands before the meal sheet's focus trap
        // pauses for this one, and the trap pulls focus straight back; from
        // here it runs once the trap has paused. Opened onto a food (an
        // edit), there is no search to focus.
        onOpenAutoFocus={(event) => {
          if (page) return;
          event.preventDefault();
          search.current?.focus();
        }}
        className="mt-0 h-[calc(100dvh-env(safe-area-inset-top)-8px)] max-h-none rounded-none border-0 bg-transparent font-sans-display text-kallo-text data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-none data-[vaul-drawer-direction=bottom]:border-0 [&>div:first-child]:hidden"
      >
        <DrawerTitle className="sr-only">{t('sheetTitle')}</DrawerTitle>
        <div
          aria-hidden
          className="absolute inset-x-3.5 top-0 rounded-t-[30px] bg-[#d9d6ce] px-6 pt-[7px] text-center text-[#55534d] text-[12px] tabular-nums leading-[15px]"
          style={{ height: PEEK + 34 }}
        >
          <span className="inline-flex max-w-full items-center gap-1 truncate">
            {!page && meal.items.length === 0 ? t('peekEmpty') : summary}
            {peekAfter && (
              <>
                <ArrowRight className="size-3 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{peekAfter}</span>
              </>
            )}
          </span>
        </div>
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[34px] bg-kallo-track shadow-[0_-6px_24px_rgba(0,0,0,0.18)]"
          style={{ marginTop: PEEK }}
        >
          <div className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-kallo-border" />
          {/* `custom` reaches the EXITING page too, so both travel the same
              way: forward into a food, back out to the results. */}
          <AnimatePresence
            mode="popLayout"
            initial={false}
            custom={page ? 1 : -1}
          >
            <motion.div
              key={page ? `food-${page.food.id}` : 'search'}
              custom={page ? 1 : -1}
              variants={PAGE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {page ? (
                <ManualFoodPage
                  food={page.food}
                  grams={grams}
                  inMeal={page.itemId !== null}
                  mealFull={full}
                  onGrams={setGrams}
                  onClose={close}
                  onBack={editing ? undefined : leave}
                  onRemove={
                    page.itemId
                      ? () => {
                          meal.remove(page.itemId as string);
                          leave();
                        }
                      : undefined
                  }
                  onCommit={() => {
                    if (page.itemId) meal.update(page.itemId, grams);
                    else {
                      meal.add(page.food, grams);
                      setAddedAny(true);
                    }
                    leave();
                  }}
                />
              ) : (
                <ManualSearchPage
                  query={query}
                  onQuery={setQuery}
                  autoFocus={!visited}
                  inputRef={search}
                  itemFor={meal.itemFor}
                  onPick={pick}
                  onClose={close}
                  showDone={addedAny}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DrawerContent>
    </VaulDrawer.NestedRoot>
  );
}
