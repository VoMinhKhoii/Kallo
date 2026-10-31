'use client';

import { AnimatePresence, motion } from 'motion/react';
import { type DishRowsMeal, MealDetails } from './meal-details';

interface PersistedMealBodyProps {
  meal: DishRowsMeal;
  isCollapsed: boolean;
  totals: { calories: string; protein: string; carbs: string; fat: string };
}

/**
 * A saved meal's read-only body: one P/C/F line and the kcal while collapsed,
 * the dishes and a Total row once opened — so the card reads meal name →
 * items → macros either way.
 */
export function PersistedMealBody({
  meal,
  isCollapsed,
  totals,
}: PersistedMealBodyProps) {
  const { calories, protein, carbs, fat } = totals;
  return (
    <>
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
            <span className="text-[11px] text-kallo-text-muted tabular-nums">
              P: {protein}
              {'  '}C: {carbs}
              {'  '}F: {fat}
            </span>
            <span className="font-bold text-kallo-text text-sm tabular-nums">
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
            <MealDetails meal={meal} totals={totals} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
