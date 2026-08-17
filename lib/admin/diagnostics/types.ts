import type { InferSelectModel } from 'drizzle-orm';
import type {
  pipelineLlmCalls,
  pipelineRequests,
  pipelineStageLogs,
} from '@/lib/infra/db/schema';

export type StageLog = InferSelectModel<typeof pipelineStageLogs>;
export type LlmCall = InferSelectModel<typeof pipelineLlmCalls>;
export type RequestRow = InferSelectModel<typeof pipelineRequests>;

export interface PipelineSummaryProps {
  request: RequestRow;
  stageLogs: StageLog[];
  llmCalls: LlmCall[];
}

export type DiagnosticStageStatus = 'success' | 'error' | 'skipped' | 'pending';

/** One retrieval candidate the cascade surfaced for an ingredient. */
export type MatchCandidateRow = {
  foodCompositionId: string;
  matchedName: string;
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
  matchType: 'vector' | 'fuzzy' | null;
  source: 'fao' | 'usda' | null;
  state: 'raw' | 'cooked' | 'unknown' | null;
};

export type MatchDiagnosticRow = {
  ingredientName: string;
  grams: number | null;
  matchedName: string | null;
  similarity: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unmatched';
  matchType: 'vector' | 'fuzzy' | null;
  source: 'fao' | 'usda' | null;
  latencyMs: number | null;
  viaAlias: boolean;
  /**
   * The full top-K pool retrieval considered, best-first. Present only on v2
   * traces — v1 logged the winner alone, so `undefined` means "this trace
   * never recorded candidates", which is different from `[]`, "retrieval
   * returned nothing".
   */
  candidates?: MatchCandidateRow[];
};
