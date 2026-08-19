import type { Goal } from '@/lib/domain/onboarding/types';

export interface AssumptionContent {
  heading: string;
  bullets: string[];
}

/**
 * Static assumption text per goal for the "?" tooltip.
 * Phase 3: one block per goal, English only.
 * Designed to accept dynamic per-meal content in a future phase.
 */
export const ASSUMPTION_TEXT: Record<Goal, AssumptionContent> = {
  cutting: {
    heading: 'How we estimate for your cut',
    bullets: [
      'Calorie and fat estimates lean toward the higher end to keep you safely in deficit.',
      'Protein estimates lean conservative so you know your minimum intake.',
      'Portions are based on your cooking profile and typical Vietnamese servings.',
      'When in doubt, we round up on calories — better to overestimate than under.',
    ],
  },
  bulking: {
    heading: 'How we estimate for your bulk',
    bullets: [
      'Calorie estimates lean toward the lower end so you hit your surplus confidently.',
      'Protein estimates lean generous to support muscle growth.',
      'Portions reflect your cooking profile and typical Vietnamese servings.',
      'When in doubt, we round down on calories — better to eat a bit more than less.',
    ],
  },
  maintaining: {
    heading: 'How we estimate your nutrition',
    bullets: [
      'All estimates use the most likely middle value for each nutrient.',
      'Portions are based on your cooking profile and typical Vietnamese servings.',
      'Cooking method adjustments account for oil, seasoning, and preparation style.',
    ],
  },
};
