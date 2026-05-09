import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PipelineSummary } from '@/app/[locale]/(app)/admin/requests/[id]/_components/pipeline-summary';

describe('PipelineSummary', () => {
  it('keeps matched-stage status textual and avoids duplicating meal-level unmatched rows', () => {
    render(
      <PipelineSummary
        request={
          {
            rawInput: 'rice bowl',
            status: 'success',
            durationMs: 120,
          } as never
        }
        llmCalls={[]}
        stageLogs={
          [
            {
              stage: 'decomposition',
              status: 'success',
              durationMs: 20,
              outputJson: {
                isFood: true,
                mealSlot: 'lunch',
                languageMetadata: {
                  inputLanguage: 'en',
                  outputLanguage: 'vi',
                  guardReason: 'matches_output_language',
                  guardSeverity: 'info',
                  guardPassed: true,
                  retryCount: 1,
                },
                mealItems: [
                  {
                    name: 'rice bowl',
                    ingredients: [
                      {
                        name: 'rice',
                        estimatedGrams: 100,
                        cookingMethod: null,
                        userFacingUnit: null,
                      },
                    ],
                  },
                ],
              },
            },
            {
              stage: 'matching',
              status: 'success',
              durationMs: 30,
              outputJson: {
                matched: [],
                unmatched: [
                  {
                    ingredientName: 'rice',
                    mealContext: 'rice bowl',
                  },
                ],
              },
            },
            {
              stage: 'assembly',
              status: 'success',
              durationMs: 40,
              outputJson: {
                mealItems: [],
                displayedNutrition: {},
              },
            },
          ] as never
        }
      />
    );

    expect(screen.getAllByText('success').length).toBeGreaterThan(0);
    expect(screen.getAllByText('en → vi')).not.toHaveLength(0);
    expect(screen.getByText('1 lang retry')).toBeInTheDocument();
    expect(screen.getByText('no match')).toBeInTheDocument();
    expect(screen.queryByText(/Unmatched output/)).not.toBeInTheDocument();
  });
});
