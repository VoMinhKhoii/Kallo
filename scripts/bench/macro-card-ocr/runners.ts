import Anthropic from '@anthropic-ai/sdk';
import { ThinkingLevel } from '@google/genai';
import sharp from 'sharp';
import { attemptCostUsd } from '@/lib/ai/cost/pricing';
import {
  MACRO_CARD_OCR_SYSTEM_PROMPT,
  normalizeMacroCardOcr,
  rawMacroCardOcrSchema,
} from '@/lib/ai/pipeline/estimator/macro-card-ocr/macro-card-ocr';
import { toProviderJsonSchema } from '@/lib/ai/prompts/schema';
import { toClaudeSchema } from '@/lib/ai/provider/claude/schema';
import {
  createGeminiClient,
  type GeminiAttemptMetadata,
  resolveGeminiProvider,
} from '@/lib/ai/provider/provider';
import { NutritionLabelOcrError } from '@/lib/domain/nutrition/ocr/error';
import type { ParsedNutritionLabel } from '@/lib/domain/nutrition/ocr/schema';
import type { ModelSpec, PreprocessMode, TokenUsage } from './types';

const USER_PROMPT =
  'Extract the single printed dish name and macro callouts accurately according to the JSON schema.';

const ZERO_TOKENS: TokenUsage = {
  inputTokens: 0,
  cachedTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  thoughtTokens: 0,
};

const CLAUDE_JSON_SCHEMA = toClaudeSchema(
  toProviderJsonSchema(rawMacroCardOcrSchema, { mode: 'slim' })
) as Record<string, unknown>;

export interface PreparedImage {
  readonly base64Data: string;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export async function prepareFixtureImage(
  rawBytes: Buffer,
  filename: string,
  mode: PreprocessMode
): Promise<PreparedImage> {
  if (mode === '1280px') {
    const resized = await sharp(rawBytes)
      .rotate()
      .resize({
        width: 1280,
        height: 1280,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { base64Data: resized.toString('base64'), mimeType: 'image/jpeg' };
  }

  const ext = filename.toLowerCase();
  const mimeType = ext.endsWith('.png')
    ? 'image/png'
    : ext.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  return { base64Data: rawBytes.toString('base64'), mimeType };
}

export function parseModelSpec(token: string): ModelSpec {
  const [rawModel, rawThinking] = token.trim().split(':');
  const model = rawModel.trim();
  const provider = model.startsWith('claude-') ? 'claude' : 'gemini';
  if (provider === 'gemini' && rawThinking === 'off') {
    throw new Error(
      `Unsupported Gemini thinking level ":off" in "${token.trim()}" (use ":minimal" or ":low")`
    );
  }
  const thinking =
    rawThinking === 'minimal' || rawThinking === 'off' || rawThinking === 'low'
      ? rawThinking
      : provider === 'gemini'
        ? 'low'
        : 'off';
  return { id: token.trim(), provider, model, thinking };
}

export interface RunnerOutcome {
  readonly status: 'ok' | 'no_label' | 'error';
  readonly parsed: ParsedNutritionLabel | null;
  readonly errorMessage: string | null;
  readonly latencyMs: number;
  readonly tokens: TokenUsage;
  readonly costUsd: number | null;
}

let cachedAnthropic: Anthropic | undefined;
function getAnthropicClient(): Anthropic {
  if (!cachedAnthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required to benchmark Claude');
    }
    cachedAnthropic = new Anthropic({ apiKey, maxRetries: 1 });
  }
  return cachedAnthropic;
}

function sumTokens(attempts: readonly GeminiAttemptMetadata[]): TokenUsage {
  let inputTokens = 0;
  let cachedTokens = 0;
  let cacheWriteTokens = 0;
  let outputTokens = 0;
  let thoughtTokens = 0;
  for (const a of attempts) {
    inputTokens += a.inputTokens ?? 0;
    cachedTokens += a.cachedTokens ?? 0;
    cacheWriteTokens += a.cacheWriteTokens ?? 0;
    outputTokens += a.outputTokens ?? 0;
    thoughtTokens += a.thoughtTokens ?? 0;
  }
  return {
    inputTokens,
    cachedTokens,
    cacheWriteTokens,
    outputTokens,
    thoughtTokens,
  };
}

async function runGemini(
  spec: ModelSpec,
  image: PreparedImage
): Promise<RunnerOutcome> {
  const attempts: GeminiAttemptMetadata[] = [];
  const t0 = Date.now();
  const thinkingConfig =
    spec.thinking === 'low'
      ? { thinkingLevel: ThinkingLevel.LOW }
      : { thinkingLevel: ThinkingLevel.MINIMAL };

  try {
    const gemini = createGeminiClient(resolveGeminiProvider(), {
      maxRetries: 2,
    });
    const raw = await gemini.generateStructuredOutput(
      {
        schema: rawMacroCardOcrSchema,
        systemPrompt: MACRO_CARD_OCR_SYSTEM_PROMPT,
        userMessage: USER_PROMPT,
        image,
        model: spec.model,
        temperature: 0.1,
        thinkingConfig,
        abortSignal: AbortSignal.timeout(25_000),
      },
      { onAttemptComplete: (m) => attempts.push(m) }
    );
    const parsed = normalizeMacroCardOcr(raw);
    const tokens = sumTokens(attempts);
    return {
      status: 'ok',
      parsed,
      errorMessage: null,
      latencyMs: Date.now() - t0,
      tokens,
      costUsd: attemptCostUsd(spec.model, tokens),
    };
  } catch (err) {
    const tokens = sumTokens(attempts);
    const isNoLabel =
      err instanceof NutritionLabelOcrError && err.code === 'no_label_detected';
    return {
      status: isNoLabel ? 'no_label' : 'error',
      parsed: null,
      errorMessage: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - t0,
      tokens,
      costUsd: attemptCostUsd(spec.model, tokens),
    };
  }
}

async function runClaude(
  spec: ModelSpec,
  image: PreparedImage
): Promise<RunnerOutcome> {
  const t0 = Date.now();
  let tokens: TokenUsage = ZERO_TOKENS;

  try {
    const anthropic = getAnthropicClient();
    const thinking = spec.model.startsWith('claude-sonnet-5-5')
      ? ({ type: 'between_tools' } as const)
      : ({ type: 'disabled' } as const);

    const message = await anthropic.messages.create(
      {
        model: spec.model,
        max_tokens: 1024,
        thinking,
        system: MACRO_CARD_OCR_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mimeType,
                  data: image.base64Data,
                },
              },
              { type: 'text', text: USER_PROMPT },
            ],
          },
        ],
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: CLAUDE_JSON_SCHEMA },
        },
      },
      { signal: AbortSignal.timeout(25_000) }
    );

    const cached = message.usage.cache_read_input_tokens ?? 0;
    const written = message.usage.cache_creation_input_tokens ?? 0;
    tokens = {
      inputTokens: message.usage.input_tokens + cached + written,
      cachedTokens: cached,
      cacheWriteTokens: written,
      outputTokens: message.usage.output_tokens,
      thoughtTokens: 0,
    };

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`Claude returned no text block (${message.stop_reason})`);
    }
    const raw = rawMacroCardOcrSchema.parse(JSON.parse(textBlock.text));
    const parsed = normalizeMacroCardOcr(raw);
    return {
      status: 'ok',
      parsed,
      errorMessage: null,
      latencyMs: Date.now() - t0,
      tokens,
      costUsd: attemptCostUsd(spec.model, tokens),
    };
  } catch (err) {
    const isNoLabel =
      err instanceof NutritionLabelOcrError && err.code === 'no_label_detected';
    return {
      status: isNoLabel ? 'no_label' : 'error',
      parsed: null,
      errorMessage: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - t0,
      tokens,
      costUsd: attemptCostUsd(spec.model, tokens),
    };
  }
}

export function runModelOnImage(
  spec: ModelSpec,
  image: PreparedImage
): Promise<RunnerOutcome> {
  return spec.provider === 'claude'
    ? runClaude(spec, image)
    : runGemini(spec, image);
}
