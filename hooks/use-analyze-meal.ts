import { useMutation } from '@tanstack/react-query';
import type { ParsedMeal } from '@/lib/types/meal';

async function analyzeMeal(message: string): Promise<ParsedMeal> {
  const response = await fetch('/api/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const errorMsg =
      typeof body?.error === 'string'
        ? body.error
        : (body?.error?.message ?? 'Failed to analyze meal');
    throw new Error(errorMsg);
  }

  return response.json();
}

export function useAnalyzeMeal() {
  return useMutation({
    mutationFn: analyzeMeal,
  });
}
