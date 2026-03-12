import type { PipelineErrorType, PipelineResponse } from '../types';

const NON_FOOD_MESSAGE =
  "We didn't recognize this as a meal description. Could you try describing what you ate differently?";

/**
 * D6 Layer 2: Vietnamese-first blocklist of non-food syntactic markers.
 * If the LLM decomposes something but an ingredient name is entirely
 * one of these, it's likely a non-food misparse.
 */
export const NON_FOOD_BLOCKLIST = new Set([
  // Vietnamese pronouns
  'tôi',
  'mình',
  'bạn',
  'anh',
  'chị',
  'em',
  'nó',
  'họ',
  // Vietnamese sentiment/state verbs
  'vui',
  'buồn',
  'mệt',
  'khỏe',
  'đói',
  'no',
  // Conjunctions/fillers as standalone
  'và',
  'hoặc',
  'nhưng',
  'vì',
  'nên',
  'thì',
]);

export class NonFoodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonFoodError';
  }
}

export function isNonFoodError(error: unknown): boolean {
  return error instanceof NonFoodError;
}

export function makeErrorResponse(
  type: PipelineErrorType,
  message: string,
  retryable: boolean
): PipelineResponse {
  return { success: false, error: { type, message, retryable } };
}

export function handleError(error: unknown): PipelineResponse {
  if (isNonFoodError(error)) {
    return makeErrorResponse('non_food_input', NON_FOOD_MESSAGE, false);
  }

  const message = error instanceof Error ? error.message : String(error);
  const isParse =
    message.includes('parse') ||
    message.includes('Zod') ||
    message.includes('JSON');

  if (isParse) {
    return makeErrorResponse(
      'parse_error',
      'We had trouble understanding the AI response. Please try again.',
      true
    );
  }

  return makeErrorResponse(
    'api_error',
    'Something went wrong analyzing your meal. Please try again.',
    true
  );
}

export function nonFoodResponse(): PipelineResponse {
  return makeErrorResponse('non_food_input', NON_FOOD_MESSAGE, false);
}
