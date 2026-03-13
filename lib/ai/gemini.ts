import { GoogleGenAI } from '@google/genai';
import { toJSONSchema, type ZodType } from 'zod';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

interface StructuredOutputParams<T> {
  schema: ZodType<T>;
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature?: number;
}

export interface GeminiClient {
  generateStructuredOutput<T>(params: StructuredOutputParams<T>): Promise<T>;
  generateEmbedding(text: string): Promise<number[]>;
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('429');
}

function parseRetryDelay(error: Error, baseDelayMs: number): number {
  const match = error.message.match(/retry in ([\d.]+)s/i);
  return match ? Number.parseFloat(match[1]) * 1000 : baseDelayMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGeminiClient(
  apiKey: string,
  retryOptions?: Partial<RetryOptions>
): GeminiClient {
  const ai = new GoogleGenAI({ apiKey });
  const retry = { ...DEFAULT_RETRY, ...retryOptions };

  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retry.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!isRateLimitError(lastError) || attempt === retry.maxRetries) {
          throw lastError;
        }

        const delay = parseRetryDelay(lastError, retry.baseDelayMs * attempt);
        await sleep(delay);
      }
    }

    throw lastError;
  }

  return {
    async generateStructuredOutput<T>(
      params: StructuredOutputParams<T>
    ): Promise<T> {
      return withRetry(async () => {
        const response = await ai.models.generateContent({
          model: params.model,
          contents: params.userMessage,
          config: {
            systemInstruction: params.systemPrompt,
            responseMimeType: 'application/json',
            responseJsonSchema: toJSONSchema(params.schema),
            ...(params.temperature != null && {
              temperature: params.temperature,
            }),
          },
        });

        const text = response.text;
        if (!text) throw new Error('Gemini returned empty response');

        return params.schema.parse(JSON.parse(text));
      });
    },

    async generateEmbedding(text: string): Promise<number[]> {
      return withRetry(async () => {
        const result = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: [{ parts: [{ text }] }],
          config: { outputDimensionality: EMBEDDING_DIMENSIONS },
        });

        const embedding = result.embeddings?.[0]?.values;
        if (!embedding) throw new Error('Gemini returned no embedding');

        return embedding;
      });
    },
  };
}
