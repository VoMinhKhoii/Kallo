'use client';

import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
  COMPOSITION_KEYS,
  compositionFromGrams,
} from '@/components/shared/nutrition/composition';
import { CompositionBar } from '@/components/shared/nutrition/composition-bar';

/** One decimal at most, the ".0" dropped; null reads "—" (unknown, never 0). */
export function formatFigure(value: number | null): string {
  if (value === null) return '—';
  return String(Math.round(value * 10) / 10);
}

/**
 * The top of every scan result — the Flutter app's `ScanResultHeader`. Two
 * leads on one row: the name by WEIGHT (28/600, two lines at most) and the
 * calories by SIZE (40/400). Under them, quietly: the brand, the calorie-share
 * bar and one ink legend line where each macro's colour lives on its glyph.
 */
export function ScanResultHeader({
  name,
  subtitle,
  kcal,
  grams,
  labels,
}: {
  name: string;
  subtitle: string | null;
  kcal: number | null;
  grams: {
    protein: number | null;
    carbohydrate: number | null;
    fat: number | null;
  };
  labels: { protein: string; carbohydrate: string; fat: string };
}) {
  const { segments } = compositionFromGrams(grams);
  return (
    <header className="pt-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="line-clamp-2 min-w-0 font-semibold text-[28px] text-kallo-text leading-[1.15] tracking-[-0.6px]">
          {name}
        </h2>
        <p className="flex shrink-0 items-baseline gap-1 text-kallo-text">
          <span className="text-[40px] tabular-nums leading-none tracking-[-1px]">
            {kcal === null ? '—' : Math.round(kcal)}
          </span>
          <span className="text-[14px]">kcal</span>
        </p>
      </div>
      {subtitle && (
        <p className="mt-1 truncate text-[14px] text-kallo-text-muted">
          {subtitle}
        </p>
      )}
      <CompositionBar segments={segments} className="mt-3.5 h-1.5" />
      <ul className="mt-2.5 flex justify-evenly">
        {COMPOSITION_KEYS.map((key) => {
          const Icon = COMPOSITION_ICONS[key];
          return (
            <li
              key={key}
              className="flex items-center gap-[5px] text-[14px] text-kallo-text tabular-nums"
            >
              <Icon
                className="size-3.5"
                style={{ color: COMPOSITION_COLORS[key] }}
              />
              {labels[key]} {formatFigure(grams[key])} g
            </li>
          );
        })}
      </ul>
    </header>
  );
}
