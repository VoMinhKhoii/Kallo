import Anthropic from '@anthropic-ai/sdk';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { VERTEX_RATE_SUFFIX } from '@/lib/ai/cost/pricing';
import type { GeminiProviderConfig } from '../client';
import type { ClaudeStructuredOutput } from './routing';
import { createClaudeStructuredOutput } from './structured-output';

let cached: ClaudeStructuredOutput | null | undefined;

/**
 * One Claude client per process, or null without ANTHROPIC_API_KEY. The SDK's
 * own retries are off: a failed call moves down the waterfall instead of waiting.
 */
export function getClaudeStructuredOutput(): ClaudeStructuredOutput | null {
  if (cached === undefined) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    cached = apiKey
      ? createClaudeStructuredOutput(new Anthropic({ apiKey, maxRetries: 0 }))
      : null;
  }
  return cached;
}

/** Haiku on Vertex AI answers on the `global` endpoint only (regions 404). */
const VERTEX_CLAUDE_REGION = 'global';

const vertexClients = new Map<string, ClaudeStructuredOutput>();

function vertexClient(project: string): ClaudeStructuredOutput {
  let client = vertexClients.get(project);
  if (!client) {
    client = createClaudeStructuredOutput(
      new AnthropicVertex({
        projectId: project,
        region: VERTEX_CLAUDE_REGION,
        maxRetries: 0,
      }),
      { rateSuffix: VERTEX_RATE_SUFFIX }
    );
    vertexClients.set(project, client);
  }
  return client;
}

/**
 * The middle step of the waterfall. Null unless the app itself runs on Vertex:
 * AI Studio setups (dev, evals) never reach it. Signs in as the runtime's
 * Google identity, with no API key.
 *
 * The SDK starts signing in when it is constructed and only handles a failure
 * once a request runs, so a client built for a meal that never reaches this
 * step could reject unhandled. Build it on the first call that needs it.
 */
export function getVertexClaudeStructuredOutput(
  config: GeminiProviderConfig
): ClaudeStructuredOutput | null {
  if (config.provider !== 'vertex') return null;
  const { project } = config;
  return {
    generateStructuredOutput: (params, opts) =>
      vertexClient(project).generateStructuredOutput(params, opts),
    generateStructuredOutputStream: (params, opts) =>
      vertexClient(project).generateStructuredOutputStream(params, opts),
  };
}

/** Visible for testing. */
export function __resetClaudeForTests(): void {
  cached = undefined;
  vertexClients.clear();
}
