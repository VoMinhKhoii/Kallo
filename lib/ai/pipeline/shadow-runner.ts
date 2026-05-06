import type {
  PipelineResponse,
  PipelineResult,
  ProcessedIngredient,
} from '../types';
import { computeDivergence, type ShadowDivergence } from './shadow-divergence';
import type { ShadowGuardAbortReason } from './shadow-guards';

export interface ShadowOutputSnapshot {
  success: boolean;
  matchedIds: string[];
  unmatchedNames: string[];
  perIngredient: Array<{
    ingredientName: string;
    foodCompositionId: string | null;
    estimatedGrams: number;
    caloriesMid: number;
  }>;
  total: {
    caloriesMid: number;
    proteinMid: number;
    carbsMid: number;
    fatMid: number;
  };
  errorType?: string;
}

export interface ShadowRunnerInput {
  requestId: string;
  primary: PipelineResponse;
  primaryRunId?: string;
  candidatePromptLabel: string;
  candidateModel: string;
}

export type ShadowOutcome = 'completed' | 'errored' | ShadowGuardAbortReason;

export interface ShadowRunPersistRow {
  requestId: string;
  primaryRunId: string | null;
  candidatePromptLabel: string;
  candidateModel: string;
  primaryOutput: ShadowOutputSnapshot;
  candidateOutput: ShadowOutputSnapshot | null;
  divergence: ShadowDivergence;
  outcome: ShadowOutcome;
  candidateMs: number;
}

export interface ShadowRunnerDeps {
  runCandidate: (requestId: string) => Promise<PipelineResponse>;
  persistShadowRun: (row: ShadowRunPersistRow) => Promise<void>;
  now: () => number;
}

export interface ShadowGuard {
  shouldRun: () => Promise<
    | { run: true }
    | {
        run: false;
        reason: ShadowGuardAbortReason;
      }
  >;
  onPrimaryComplete: (primaryMs: number) => void;
}

const emptySnapshot = (errorType: string): ShadowOutputSnapshot => ({
  success: false,
  matchedIds: [],
  unmatchedNames: [],
  perIngredient: [],
  total: { caloriesMid: 0, proteinMid: 0, carbsMid: 0, fatMid: 0 },
  errorType,
});

function snapshot(r: PipelineResponse): ShadowOutputSnapshot {
  if (!r.success) {
    return emptySnapshot(r.error.type);
  }

  const data: PipelineResult = r.data;
  const allIngredients: ProcessedIngredient[] = data.mealItems.flatMap(
    (m) => m.ingredients
  );
  const matchedIds = allIngredients
    .map((i) => i.foodCompositionId)
    .filter((id): id is string => id !== null);
  const unmatchedNames = data.unmatchedIngredients.map((u) => u.ingredientName);
  const bn = data.boundedNutrition;

  return {
    success: true,
    matchedIds,
    unmatchedNames,
    perIngredient: allIngredients.map((i) => ({
      ingredientName: i.ingredientName,
      foodCompositionId: i.foodCompositionId,
      estimatedGrams: i.estimatedGrams,
      caloriesMid: i.boundedNutrition.caloriesKcal?.mid ?? 0,
    })),
    total: {
      caloriesMid: bn.caloriesKcal?.mid ?? 0,
      proteinMid: bn.proteinG?.mid ?? 0,
      carbsMid: bn.carbohydrateG?.mid ?? 0,
      fatMid: bn.fatG?.mid ?? 0,
    },
  };
}

export async function runShadow(
  input: ShadowRunnerInput,
  deps: ShadowRunnerDeps
): Promise<void> {
  const start = deps.now();
  let outcome: ShadowOutcome = 'completed';
  let candidate: PipelineResponse | null = null;

  try {
    candidate = await deps.runCandidate(input.requestId);
  } catch {
    outcome = 'errored';
  }

  const row: ShadowRunPersistRow = {
    requestId: input.requestId,
    primaryRunId: input.primaryRunId ?? null,
    candidatePromptLabel: input.candidatePromptLabel,
    candidateModel: input.candidateModel,
    primaryOutput: snapshot(input.primary),
    candidateOutput: candidate ? snapshot(candidate) : null,
    divergence: computeDivergence(input.primary, candidate),
    outcome,
    candidateMs: deps.now() - start,
  };

  try {
    await deps.persistShadowRun(row);
  } catch {
    console.warn('[shadow-runner] persist failed', {
      requestId: input.requestId,
    });
  }
}

export async function runShadowAsync(
  input: ShadowRunnerInput,
  deps: ShadowRunnerDeps,
  guard: ShadowGuard
): Promise<void> {
  let decision: Awaited<ReturnType<ShadowGuard['shouldRun']>>;
  try {
    decision = await guard.shouldRun();
  } catch {
    return;
  }

  if (!decision.run) {
    const row: ShadowRunPersistRow = {
      requestId: input.requestId,
      primaryRunId: input.primaryRunId ?? null,
      candidatePromptLabel: input.candidatePromptLabel,
      candidateModel: input.candidateModel,
      primaryOutput: snapshot(input.primary),
      candidateOutput: null,
      divergence: computeDivergence(input.primary, null),
      outcome: decision.reason,
      candidateMs: 0,
    };
    try {
      await deps.persistShadowRun(row);
    } catch {
      console.warn('[shadow-runner] aborted-row persist failed', {
        requestId: input.requestId,
        reason: decision.reason,
      });
    }
    return;
  }

  return runShadow(input, deps);
}
