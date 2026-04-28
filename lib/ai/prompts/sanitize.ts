export function sanitizePromptContextValue(value: string): string {
  return value
    .replace(/[<>&"'`\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPromptContextLine(
  label: string,
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const safeValue = sanitizePromptContextValue(value);
  return safeValue ? `  ${label}: ${safeValue}` : null;
}
