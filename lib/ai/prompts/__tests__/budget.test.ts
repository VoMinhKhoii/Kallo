import { describe, expect, it } from 'vitest';
import { measurePromptBudget } from '@/lib/ai/prompts/budget';

describe('measurePromptBudget', () => {
  it('splits system, user, schema chars, and estimates provider-neutral tokens', () => {
    const systemPrompt = 'Static system prompt.';
    const userMessage = 'Dynamic meal data from the user.';
    const schema = {
      type: 'object',
      properties: {
        mealItems: { type: 'array' },
      },
      required: ['mealItems'],
    };
    const schemaChars = JSON.stringify(schema).length;

    expect(measurePromptBudget({ systemPrompt, userMessage, schema })).toEqual({
      systemChars: systemPrompt.length,
      userChars: userMessage.length,
      schemaChars,
      approxTokens: Math.ceil(
        (systemPrompt.length + userMessage.length + schemaChars) / 4
      ),
    });
  });

  it('uses pre-serialized schema length without adding JSON string quotes', () => {
    const systemPrompt = 'system';
    const userMessage = 'user';
    const schema = '{"type":"object"}';

    expect(measurePromptBudget({ systemPrompt, userMessage, schema })).toEqual({
      systemChars: 6,
      userChars: 4,
      schemaChars: schema.length,
      approxTokens: Math.ceil((6 + 4 + schema.length) / 4),
    });
  });
});
