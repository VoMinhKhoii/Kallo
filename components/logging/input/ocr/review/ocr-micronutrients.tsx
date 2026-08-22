'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { type MacroItem, OcrNutrientGrid } from './ocr-nutrient-grid';

/**
 * The optional nutrients the label happened to print, behind a disclosure.
 *
 * A rich label carries two dozen of these. Open, they bury the four figures
 * that actually decide the meal under a wall of identical fields; the count on
 * the toggle says they are there without spending the height. Closed by
 * default because the scan already filled them in — they are for correcting,
 * not for entering.
 */
export function OcrMicronutrients({
  items,
  label,
}: {
  items: MacroItem[];
  /** Already interpolated with the count. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-full items-center justify-between text-[14px] text-kallo-text-muted"
      >
        {label}
        <ChevronDown
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <OcrNutrientGrid items={items} />}
    </div>
  );
}
