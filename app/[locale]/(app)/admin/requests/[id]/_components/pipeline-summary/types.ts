import type { InferSelectModel } from 'drizzle-orm';
import type {
  pipelineLlmCalls,
  pipelineRequests,
  pipelineStageLogs,
} from '@/lib/db/schema';

export type StageLog = InferSelectModel<typeof pipelineStageLogs>;
export type LlmCall = InferSelectModel<typeof pipelineLlmCalls>;
export type RequestRow = InferSelectModel<typeof pipelineRequests>;

export interface PipelineSummaryProps {
  request: RequestRow;
  stageLogs: StageLog[];
  llmCalls: LlmCall[];
}

export type DiagnosticStageStatus = 'success' | 'error' | 'skipped' | 'pending';

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
};
