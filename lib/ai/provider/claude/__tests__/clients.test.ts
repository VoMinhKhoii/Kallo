import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { StructuredOutputParams } from '../../types';
import {
  __resetClaudeForTests,
  getVertexClaudeStructuredOutput,
} from '../clients';

const vertexSdk = vi.hoisted(() => ({
  AnthropicVertex: vi.fn(function (this: { messages: unknown }) {
    this.messages = {
      stream: () => {
        throw new Error('stream reached');
      },
    };
  }),
}));
vi.mock('@anthropic-ai/vertex-sdk', () => vertexSdk);

const params = (model: string) =>
  ({
    schema: z.unknown(),
    systemPrompt: 's',
    userMessage: 'u',
    model,
  }) as StructuredOutputParams<unknown>;

describe('getVertexClaudeStructuredOutput', () => {
  const onVertex = (project: string) =>
    ({ provider: 'vertex', project, location: 'global' }) as const;
  beforeEach(() => {
    __resetClaudeForTests();
    vertexSdk.AnthropicVertex.mockClear();
  });

  it('is off unless the app runs on Vertex, whatever ran before', () => {
    getVertexClaudeStructuredOutput(onVertex('p'));
    expect(
      getVertexClaudeStructuredOutput({ provider: 'ai-studio', apiKey: 'k' })
    ).toBeNull();
  });

  it('signs nothing in until a call reaches this step', async () => {
    const step = getVertexClaudeStructuredOutput(onVertex('p'));
    expect(vertexSdk.AnthropicVertex).not.toHaveBeenCalled();
    await expect(
      step?.generateStructuredOutput(params('claude-haiku-5-5'))
    ).rejects.toThrow('stream reached');
    expect(vertexSdk.AnthropicVertex).toHaveBeenCalledTimes(1);
  });

  it('keeps one client per project, each billing its own', async () => {
    for (const project of ['a', 'a', 'b'])
      await getVertexClaudeStructuredOutput(onVertex(project))
        ?.generateStructuredOutput(params('claude-haiku-5-5'))
        .catch(() => undefined);
    expect(
      vertexSdk.AnthropicVertex.mock.calls.map(
        ([o]: unknown[]) => (o as { projectId: string }).projectId
      )
    ).toEqual(['a', 'b']);
  });
});
