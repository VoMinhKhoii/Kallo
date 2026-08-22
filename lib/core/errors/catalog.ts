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
  RateLimitedError,
} from '@/lib/core/errors/app-error';

const DEFAULT_MESSAGES = {
  notAuthenticated: 'You need to sign in to use this feature.',
  profileNotFound: 'Profile not found. Please sign in again.',
  pipelineTimeout: 'Analysis took too long. Please try again.',
  rateLimited: 'The service is busy. Please wait a moment and try again.',
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

  rateLimited: (message?: string, retryAfterSeconds?: number) =>
    new RateLimitedError(
      message ?? DEFAULT_MESSAGES.rateLimited,
      retryAfterSeconds
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
