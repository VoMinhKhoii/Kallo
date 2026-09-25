import type { ThinkingLevel } from '@google/genai';
import type { ZodType } from 'zod';
import type { AppDb } from '@/lib/infra/db/client';

export interface StructuredOutputParams<T> {
  schema: ZodType<T>;
  systemPrompt: string;
  userMessage: string;
  image?: { mimeType: string; base64Data: string };
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  thinkingConfig?: { thinkingLevel?: ThinkingLevel };
  abortSignal?: AbortSignal;
}

export interface GeminiCallTrace {
  db: AppDb;
  requestId: string;
  stageLogId: string;
  promptVersionId: string | Promise<string | null>;
  promptRendered: string;
}

export interface GeminiAttemptMetadata {
  attempt: number;
  model: string;
  inputTokens: number | null;
  /** Visible response tokens (`candidatesTokenCount`) — excludes thinking. */
  outputTokens: number | null;
  /** Prompt tokens served from Gemini's cache, billed at the cached rate. */
  cachedTokens?: number | null;
  /** Thinking tokens (`thoughtsTokenCount`), billed at the output rate. */
  thoughtTokens?: number | null;
  error: unknown;
}

/** Per-attempt hooks for a non-streamed structured-output call. */
export interface StructuredOutputOptions {
  onAttemptComplete?: (metadata: GeminiAttemptMetadata) => void;
}

export interface StreamOptions {
  onAttemptStart?: (attempt: number) => void;
  onAttemptComplete?: (metadata: GeminiAttemptMetadata) => void;
  onChunk?: (accumulated: string) => void;
  trace?: GeminiCallTrace;
}

export interface GeminiClient {
  generateStructuredOutput<T>(
    params: StructuredOutputParams<T>,
    opts?: StructuredOutputOptions
  ): Promise<T>;
  generateStructuredOutputStream<T>(
    params: StructuredOutputParams<T>,
    opts?: StreamOptions
  ): Promise<T>;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddingBatch(texts: string[]): Promise<number[][]>;
}
