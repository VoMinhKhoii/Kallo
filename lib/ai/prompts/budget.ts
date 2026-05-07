export interface PromptBudget {
  systemChars: number;
  userChars: number;
  schemaChars: number;
  approxTokens: number;
}

export interface PromptBudgetInput {
  systemPrompt: string;
  userMessage: string;
  schema: unknown;
}

function countSchemaChars(schema: unknown): number {
  if (schema == null) return 0;
  if (typeof schema === 'string') return schema.length;
  return JSON.stringify(schema)?.length ?? 0;
}

export function measurePromptBudget(input: PromptBudgetInput): PromptBudget {
  const systemChars = input.systemPrompt.length;
  const userChars = input.userMessage.length;
  const schemaChars = countSchemaChars(input.schema);
  const totalChars = systemChars + userChars + schemaChars;

  return {
    systemChars,
    userChars,
    schemaChars,
    approxTokens: Math.ceil(totalChars / 4),
  };
}
