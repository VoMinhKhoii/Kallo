'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Drawer as VaulDrawer } from 'vaul';
import { DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import {
  initialManualGrams,
  type ManualSheetItem,
  manualPeek,
} from '@/lib/domain/logging/manual-display';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import { ManualFoodPage } from './manual-food-page';
import { ManualPeekStrip, PEEK_HEIGHT } from './manual-peek-strip';
import { ManualSearchPage } from './manual-search-page';
import type { ManualSheetState } from './use-manual-sheet';

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

  // A new food on a full plate cannot go in: its page says so, and the strip
  // promises nothing for it.
  const itemId = page?.itemId ?? null;
  const blocked = meal.full && page !== null && itemId === null;

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
        <ManualPeekStrip
          peek={manualPeek(
            meal.items,
            page && !blocked ? { ...page, grams } : null
          )}
        />
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[34px] bg-kallo-track shadow-[0_-6px_24px_rgba(0,0,0,0.18)]"
          style={{ marginTop: PEEK_HEIGHT }}
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
                  inMeal={itemId !== null}
                  blocked={blocked}
                  onGrams={setGrams}
                  onClose={close}
                  onBack={editing ? undefined : leave}
                  onRemove={
                    itemId
                      ? () => {
                          meal.remove(itemId);
                          leave();
                        }
                      : undefined
                  }
                  onCommit={() => {
                    if (itemId) meal.update(itemId, grams);
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
