import type Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { StructuredOutputParams } from '../../types';
import {
  createClaudeStructuredOutput,
  systemBlocks,
} from '../structured-output';

interface Reply {
  text: string;
  stop?: string;
  error?: Error;
  /** The SDK's message snapshot when the stream fails (after message_start). */
  current?: { usage: typeof USAGE };
}

const USAGE = {
  input_tokens: 100,
  output_tokens: 40,
  cache_read_input_tokens: 3000,
  cache_creation_input_tokens: 0,
};

/** A fake client whose nth `messages.stream` call plays the nth reply. */
function fakeClaude(replies: Reply[]) {
  const stream = vi.fn((_body: unknown, _opts: unknown) => {
    const reply = replies.shift();
    if (!reply) throw new Error('no reply scripted');
    let onText: (delta: string) => void = () => {};
    return {
      currentMessage: reply.current,
      on(event: string, cb: (delta: string) => void) {
        if (event === 'text') onText = cb;
      },
      async finalMessage() {
        if (reply.error) throw reply.error;
        // Stream in three deltas, as the API does in many small ones.
        const third = Math.ceil(reply.text.length / 3);
        for (let i = 0; i < reply.text.length; i += third)
          onText(reply.text.slice(i, i + third));
        return { stop_reason: reply.stop ?? 'end_turn', usage: USAGE };
      },
    };
  });
  return {
    client: { messages: { stream } } as unknown as Anthropic,
    stream,
  };
}

const schema = z.object({ dish: z.string(), grams: z.number() });

const params = (
  extra: Partial<StructuredOutputParams<z.infer<typeof schema>>> = {}
): StructuredOutputParams<z.infer<typeof schema>> => ({
  schema,
  systemPrompt: 'static rules\n<user_context>\ngoal: cutting',
  userMessage: 'phở bò',
  model: 'claude-haiku-5-5',
  ...extra,
});

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('systemBlocks', () => {
  it('puts the cache breakpoint before the first per-user block', () => {
    const blocks = systemBlocks('rules\nmore rules\n<language>\nvi\n');
    expect(blocks).toEqual([
      {
        type: 'text',
        text: 'rules\nmore rules\n',
        cache_control: { type: 'ephemeral' },
      },
      { type: 'text', text: '<language>\nvi\n' },
    ]);
  });

  it('caches the whole prompt when it has no per-user block', () => {
    expect(systemBlocks('rules only')).toEqual([
      {
        type: 'text',
        text: 'rules only',
        cache_control: { type: 'ephemeral' },
      },
    ]);
  });

  it('sends the same text either way', () => {
    const prompt = 'a\n<user_context>\nb\n<language>\nc';
    expect(
      systemBlocks(prompt)
        .map((b) => b.text)
        .join('')
    ).toBe(prompt);
  });
});

describe('createClaudeStructuredOutput', () => {
  it('streams the text to onChunk and returns the parsed answer', async () => {
    const { client, stream } = fakeClaude([
      { text: '{"dish":"Phở bò","grams":450}' },
    ]);
    const onChunk = vi.fn();
    const out = await createClaudeStructuredOutput(
      client
    ).generateStructuredOutputStream(params(), { onChunk });

    expect(out).toEqual({ dish: 'Phở bò', grams: 450 });
    expect(onChunk).toHaveBeenLastCalledWith('{"dish":"Phở bò","grams":450}');
    const body = stream.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'claude-haiku-5-5',
      thinking: { type: 'disabled' },
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: 'phở bò' }],
    });
  });

  it('re-asks once after a schema slip', async () => {
    const { client, stream } = fakeClaude([
      { text: '{"dish":"Phở bò"}' },
      { text: '{"dish":"Phở bò","grams":450}' },
    ]);
    const attempts: number[] = [];
    const out = await createClaudeStructuredOutput(
      client
    ).generateStructuredOutputStream(params(), {
      onAttemptStart: (n) => attempts.push(n),
    });

    expect(out.grams).toBe(450);
    expect(stream).toHaveBeenCalledTimes(2);
    expect(attempts).toEqual([1, 2]);
  });

  it('gives up after the second schema slip', async () => {
    const { client, stream } = fakeClaude([
      { text: '{"dish":"a"}' },
      { text: '{"dish":"b"}' },
    ]);
    await expect(
      createClaudeStructuredOutput(client).generateStructuredOutput(params())
    ).rejects.toThrow();
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('throws an API error at once, so the router can fall back', async () => {
    const overloaded = Object.assign(new Error('overloaded'), { status: 529 });
    const { client, stream } = fakeClaude([
      { text: '', error: overloaded },
      { text: '{"dish":"Phở bò","grams":450}' },
    ]);
    await expect(
      createClaudeStructuredOutput(client).generateStructuredOutput(params())
    ).rejects.toBe(overloaded);
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it('throws on a truncated answer instead of parsing it', async () => {
    const { client } = fakeClaude([
      { text: '{"dish":"Phở', stop: 'max_tokens' },
    ]);
    await expect(
      createClaudeStructuredOutput(client).generateStructuredOutput(params())
    ).rejects.toThrow('max_tokens');
  });

  it('reports cache reads in the usage the trace reads', async () => {
    const { client } = fakeClaude([{ text: '{"dish":"Phở bò","grams":450}' }]);
    const onAttemptComplete = vi.fn();
    await createClaudeStructuredOutput(client).generateStructuredOutput(
      params(),
      { onAttemptComplete }
    );
    expect(onAttemptComplete.mock.calls[0][0]).toMatchObject({
      inputTokens: 3100,
      outputTokens: 40,
      cachedTokens: 3000,
      thoughtTokens: 0,
    });
  });

  it('keeps the input counters of a stream that failed mid-way', async () => {
    const dropped = Object.assign(new Error('connection reset'), {
      status: 500,
    });
    const { client } = fakeClaude([
      { text: '', error: dropped, current: { usage: USAGE } },
    ]);
    const onAttemptComplete = vi.fn();
    await expect(
      createClaudeStructuredOutput(client).generateStructuredOutput(params(), {
        onAttemptComplete,
      })
    ).rejects.toBe(dropped);
    expect(onAttemptComplete.mock.calls[0][0]).toMatchObject({
      error: dropped,
      inputTokens: 3100,
      cachedTokens: 3000,
    });
  });
});
