'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { getFoodSourceCandidates } from '@/lib/nutrition/actions';
import {
  SUPPORTED_CANDIDATE_NUTRIENTS,
  type SupportedCandidateNutrient,
} from '@/lib/nutrition/nutrients';
import type {
  NutrientCardData,
  NutritionNutrientKey,
} from '@/lib/nutrition/types';

const supportedCandidateNutrients: ReadonlySet<string> = new Set(
  SUPPORTED_CANDIDATE_NUTRIENTS
);

interface FoodSourceCandidatesPanelProps {
  card: NutrientCardData;
}

function isSupportedCandidateNutrient(
  nutrient: NutritionNutrientKey
): nutrient is SupportedCandidateNutrient {
  return supportedCandidateNutrients.has(nutrient);
}

export function FoodSourceCandidatesPanel({
  card,
}: FoodSourceCandidatesPanelProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const [open, setOpen] = useState(false);
  const candidateNutrient = isSupportedCandidateNutrient(card.nutrient)
    ? card.nutrient
    : null;
  const canShowCandidates =
    card.supportsCandidates &&
    card.confidence >= 40 &&
    card.percentOfTarget !== null &&
    card.percentOfTarget < 90 &&
    candidateNutrient !== null;
  const panelId = `nutrition-candidates-${card.nutrient}`;
  const candidatesQuery = useQuery({
    queryKey: ['nutrition', 'candidates', candidateNutrient],
    queryFn: () => {
      if (!candidateNutrient) {
        throw new Error('Unsupported nutrition candidate nutrient.');
      }

      return getFoodSourceCandidates({ nutrient: candidateNutrient });
    },
    enabled: open && canShowCandidates,
    staleTime: 60_000,
  });

  if (!canShowCandidates) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex touch-manipulation items-center rounded-xl bg-nham-btn px-3 py-2 font-medium text-card text-sm transition-colors hover:bg-nham-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
      >
        {open ? t('candidates.close') : t('candidates.open')}
      </button>

      <div id={panelId} aria-live="polite">
        {open ? (
          <section className="mt-3 rounded-2xl border border-nham-border/60 bg-nham-hover/35 p-4">
            <h4 className="font-semibold text-nham-text text-sm">
              {t('candidates.title')}
            </h4>
            <p className="mt-1 text-nham-text-muted text-xs leading-5">
              {t('candidates.description')}
            </p>

            {candidatesQuery.isLoading ? (
              <p className="mt-3 text-nham-text-muted text-sm">
                {t('candidates.loading')}
              </p>
            ) : candidatesQuery.isError ? (
              <div className="mt-3" role="alert">
                <p className="text-nham-text-muted text-sm">
                  {t('candidates.error')}
                </p>
                <button
                  type="button"
                  onClick={() => candidatesQuery.refetch()}
                  className="mt-2 inline-flex touch-manipulation items-center rounded-xl border border-nham-border/60 px-3 py-2 font-medium text-nham-text text-sm transition-colors hover:bg-nham-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
                >
                  {t('candidates.retry')}
                </button>
              </div>
            ) : candidatesQuery.data ? (
              <ul className="mt-3 divide-y divide-nham-border/60">
                {candidatesQuery.data.candidates.map((candidate) => (
                  <li key={candidate.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="font-medium text-nham-text text-sm">
                      {tRoot(candidate.nameKey)}
                    </p>
                    <p className="mt-1 text-nham-text-muted text-xs">
                      {tRoot(candidate.servingKey)}
                    </p>
                    <p className="mt-1 text-nham-text-muted text-xs leading-5">
                      {tRoot(candidate.rationaleKey)}
                    </p>
                    {candidate.cautionKey ? (
                      <p className="mt-1 text-nham-text-muted text-xs leading-5">
                        {tRoot(candidate.cautionKey)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
