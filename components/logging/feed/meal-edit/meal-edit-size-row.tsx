'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef } from 'react';
import {
  gramEnvelope,
  repointVesselTo,
  vesselAnchors,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { portionDisplay } from '@/components/logging/feed/meal-entry/portion/portion-display';
import { VesselTape } from '@/components/logging/feed/meal-entry/portion/tape/vessel-tape';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';
import { cn } from '@/lib/core/ui/cn';

interface MealEditSizeRowProps {
  vessel: ClientVessel;
  grams: number;
  open: boolean;
  onToggle: () => void;
  onChange: (grams: number) => void;
}

/**
 * The Size row of a dish with a vessel, and the vessel tape it drops open in
 * place, as the iOS sheet does. It writes grams live, like Amount, and the
 * label follows the grams, so Servings and Amount move the size it names too.
 */
export function MealEditSizeRow({
  vessel,
  grams,
  open,
  onToggle,
  onChange,
}: MealEditSizeRowProps) {
  const t = useTranslations('logging.mealEdit');
  const tPortion = useTranslations('logging.portionPicker');
  const locale = useLocale();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const loc = locale === 'vi' ? 'vi' : 'en';
  const rounded = Math.round(grams);
  const shown = repointVesselTo(vessel, rounded, locale);
  const { label } = portionDisplay(shown, rounded, loc);
  const anchors = vesselAnchors(shown, loc);
  const { min, max } = gramEnvelope(anchors);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
        className="-mx-3.5 flex min-h-[46px] w-[calc(100%+1.75rem)] items-center gap-2.5 px-3.5 text-left font-sans-display text-kallo-text text-sm transition-colors hover:bg-kallo-hover/40"
      >
        <span>{t('size')}</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-kallo-text-muted">
          <span className="truncate first-letter:uppercase">{label}</span>
          <ChevronDown
            className={cn(
              'size-icon-inline shrink-0 transition-transform duration-200',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={panelId}
            key="picker"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            // A last dish opens past the fold; so can the one the card's
            // portion line opened the dialog onto.
            onAnimationComplete={() =>
              panelRef.current?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
              })
            }
            // On a phone the dialog is a drawer: dragging the ruler must not
            // drag the sheet.
            data-vaul-no-drag
          >
            <div className="px-1 pt-1 pb-4">
              <VesselTape
                vessel={shown}
                anchors={anchors}
                grams={Math.min(max, Math.max(min, rounded))}
                min={min}
                max={max}
                label={tPortion('title')}
                onChange={onChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
