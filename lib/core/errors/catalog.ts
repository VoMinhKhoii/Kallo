// ---------------------------------------------------------------------------
// Error factories
//
// Defaults are English. Call sites that have access to the user's locale
// (the analyze-meal route, [locale] server actions) should resolve the
// translation via next-intl `getTranslations('errors')` and pass it in via
// the optional `message` argument. Call sites without a locale context fall
// back to the English default — which matches `defaultLocale: 'en'`.
// ---------------------------------------------------------------------------

import {
  AppError,
  FeatureLockedError,
  type FeatureLockedReason,
  PayloadTooLargeError,
  RateLimitedError,
  RateLimitUnavailableError,
  type RateLimitUnavailableKind,
} from '@/lib/core/errors/app-error';

/** Fixed back-off handed to clients when the limiter itself is unavailable. */
const RATE_LIMITER_UNAVAILABLE_RETRY_AFTER_SECONDS = 10;

const DEFAULT_MESSAGES = {
  notAuthenticated: 'You need to sign in to use this feature.',
  profileNotFound: 'Profile not found. Please sign in again.',
  pipelineTimeout: 'Analysis took too long. Please try again.',
  rateLimited: 'The service is busy. Please wait a moment and try again.',
  rateLimiterUnavailable:
    'The service is temporarily unavailable. Please try again shortly.',
  featureLocked: 'Upgrade to keep using this feature.',
  internal: 'Something went wrong. Please try again.',
} as const;

export const Errors = {
  notAuthenticated: (message?: string) =>
    new AppError(
      'NOT_AUTHENTICATED',
      401,
      false,
      message ?? DEFAULT_MESSAGES.notAuthenticated
    ),

  profileNotFound: (message?: string) =>
    new AppError(
      'PROFILE_NOT_FOUND',
      404,
      false,
      message ?? DEFAULT_MESSAGES.profileNotFound
    ),

  pipelineTimeout: (message?: string) =>
    new AppError(
      'PIPELINE_TIMEOUT',
      504,
      true,
      message ?? DEFAULT_MESSAGES.pipelineTimeout
    ),

  validationFailed: (detail: string) =>
    new AppError('VALIDATION_FAILED', 400, false, detail),

  notFound: (detail: string) => new AppError('NOT_FOUND', 404, false, detail),

  conflict: (detail: string) => new AppError('CONFLICT', 409, false, detail),

  // A body that blew its cap. 413 rather than 400: the request was well-formed
  // as far as anyone got to look, it was simply too big, and the distinction is
  // what tells a client to send less instead of to send something different.
  payloadTooLarge: (detail: string) => new PayloadTooLargeError(detail),

  // A circle quota (groups, friends) that belongs to SOMEONE OTHER than the
  // actor. Deliberately 409, not 402: a paywall would be shown to the wrong
  // user. The actor's own quota denials go through `featureLocked`.
  circleLimitReached: (detail: string) =>
    new AppError('CIRCLE_LIMIT_REACHED', 409, false, detail),

  rateLimited: (message?: string, retryAfterSeconds?: number) =>
    new RateLimitedError(
      message ?? DEFAULT_MESSAGES.rateLimited,
      retryAfterSeconds
    ),

  // The limiter could not decide, on a route whose policy fails closed.
  // `kind` separates "the deadline fired" (pool saturated, shedding) from
  // "the round trip failed" (database down) for telemetry; both are the same
  // 503 to the caller.
  rateLimiterUnavailable: (
    cause?: unknown,
    kind: RateLimitUnavailableKind = 'error',
    message?: string
  ) =>
    new RateLimitUnavailableError(
      message ?? DEFAULT_MESSAGES.rateLimiterUnavailable,
      RATE_LIMITER_UNAVAILABLE_RETRY_AFTER_SECONDS,
      kind,
      cause
    ),

  featureLocked: (
    feature: string,
    reason: FeatureLockedReason,
    message?: string
  ) =>
    new FeatureLockedError(
      feature,
      reason,
      message ?? DEFAULT_MESSAGES.featureLocked
    ),

  internal: (cause?: unknown, message?: string) =>
    new AppError(
      'INTERNAL',
      500,
      true,
      message ?? DEFAULT_MESSAGES.internal,
      cause
    ),
};
