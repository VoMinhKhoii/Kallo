import type { UserContext } from '@/lib/ai/types';

/**
 * Spec §3.1 — the only `UserContext` slice that prompt builders are allowed
 * to read. Goal, aggression, and any future preference targets are
 * deliberately excluded so TypeScript prevents preference leakage at compile
 * time. See Principle A in the design spec:
 * docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md
 */
export type PromptPersonalizationContext = Pick<
  UserContext,
  'countryOfOrigin' | 'countryOfResidence' | 'cookingHabits'
>;
