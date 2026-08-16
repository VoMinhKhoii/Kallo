'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { forwardRef } from 'react';
import {
  buildPieceAnchors,
  claimedAnchor,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import {
  PIECE_TIERS,
  pieceAssetFor,
  VESSEL_FAMILIES,
} from '@/lib/ai/portion/vessel-data';
import type { ClientVessel } from '@/lib/ai/portion/vessel-types';

interface PortionAssumptionLineProps
  extends React.ComponentPropsWithoutRef<'button'> {
  vessel: ClientVessel;
  /** The item's current grams — decides whether a tier label is honest. */
  grams: number;
}

/**
 * A quiet one-line portion assumption under a meal item — a small vessel
 * thumbnail and '≈ {tier label}', kept visually subordinate to the macros.
 * The whole line is the button that opens the portion picker (used as the
 * picker's trigger via `asChild`, so it forwards ref + props).
 */
export const PortionAssumptionLine = forwardRef<
  HTMLButtonElement,
  PortionAssumptionLineProps
>(({ vessel, grams, ...props }, ref) => {
  const t = useTranslations('logging.portionPicker');
  const locale = useLocale();
  const loc = locale === 'vi' ? 'vi' : 'en';

  let thumb: { file: string; aspect: number };
  let label: string;
  if ('dishClass' in vessel) {
    const tier = VESSEL_FAMILIES[vessel.family].tiers[vessel.tier];
    thumb = { file: tier.asset, aspect: tier.aspect };
    label = tier.label[loc];
  } else {
    // Only claim a tier label the picker would also commit; otherwise state
    // the honest gram amount.
    const claimed = claimedAnchor(buildPieceAnchors(vessel, loc), grams);
    const tier = PIECE_TIERS[(claimed?.tier ?? vessel.tier) - 1];
    const prefix = vessel.count > 1 ? `${vessel.count} × ` : '';
    const asset = pieceAssetFor(tier, vessel.kind);
    thumb = { file: asset.file, aspect: asset.aspect };
    label = claimed ? `${prefix}${claimed.label}` : `${prefix}${grams} g`;
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={t('adjust', { label })}
      className="-mt-1 flex min-h-[40px] items-center gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-kallo-hover/40"
      {...props}
    >
      <span className="flex shrink-0 items-end">
        <Image
          src={`/portions/${thumb.file}`}
          alt=""
          width={Math.round(20 * thumb.aspect)}
          height={20}
          className="h-5 w-auto opacity-80"
        />
      </span>
      <span className="text-[12px] text-kallo-text-muted">
        {t('assumption', { label })}
      </span>
    </button>
  );
});

PortionAssumptionLine.displayName = 'PortionAssumptionLine';
