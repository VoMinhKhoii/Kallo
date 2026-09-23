import { eq } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';
import {
  pendingAnalyses,
  pipelineRequests,
  productTelemetryEvents,
  unmatchedIngredients,
} from '@/lib/infra/db/schema';

/**
 * What the app recorded while the user used it: every meal-analysis request
 * (the sentence and the profile context sent with it), analyses staged but not
 * yet saved, ingredient names the food database could not match, and
 * first-party product telemetry tied to the account.
 *
 * Operational columns with no meaning to the user are dropped: the internal
 * error text, prompt-version bookkeeping and admin replay/dry-run markers on
 * `pipeline_requests`.
 */
export async function loadActivityExport(db: AppDb, userId: string) {
  const [requestRows, pendingRows, unmatchedRows, telemetryRows] =
    await Promise.all([
      db
        .select({
          id: pipelineRequests.id,
          rawInput: pipelineRequests.rawInput,
          userContext: pipelineRequests.userContextJson,
          status: pipelineRequests.status,
          durationMs: pipelineRequests.durationMs,
          createdAt: pipelineRequests.createdAt,
        })
        .from(pipelineRequests)
        .where(eq(pipelineRequests.userId, userId)),
      db
        .select({
          id: pendingAnalyses.id,
          rawInput: pendingAnalyses.rawInput,
          pipelineResult: pendingAnalyses.pipelineResult,
          entryMode: pendingAnalyses.entryMode,
          pipelineRequestId: pendingAnalyses.pipelineRequestId,
          sourceInviteId: pendingAnalyses.sourceInviteId,
          loggedAt: pendingAnalyses.loggedAt,
          expiresAt: pendingAnalyses.expiresAt,
          createdAt: pendingAnalyses.createdAt,
        })
        .from(pendingAnalyses)
        .where(eq(pendingAnalyses.userId, userId)),
      db
        .select({
          id: unmatchedIngredients.id,
          mealId: unmatchedIngredients.mealId,
          queryText: unmatchedIngredients.queryText,
          mealContext: unmatchedIngredients.mealContext,
          createdAt: unmatchedIngredients.createdAt,
        })
        .from(unmatchedIngredients)
        .where(eq(unmatchedIngredients.userId, userId)),
      db
        .select({
          eventId: productTelemetryEvents.eventId,
          eventName: productTelemetryEvents.eventName,
          occurredAt: productTelemetryEvents.occurredAt,
          platform: productTelemetryEvents.platform,
          appVersion: productTelemetryEvents.appVersion,
          locale: productTelemetryEvents.locale,
          sessionId: productTelemetryEvents.sessionId,
          anonymousId: productTelemetryEvents.anonymousId,
          consent: productTelemetryEvents.consent,
          pipelineRequestId: productTelemetryEvents.pipelineRequestId,
          mealId: productTelemetryEvents.mealId,
          properties: productTelemetryEvents.properties,
          receivedAt: productTelemetryEvents.receivedAt,
        })
        .from(productTelemetryEvents)
        .where(eq(productTelemetryEvents.userId, userId)),
    ]);

  return {
    analysis: {
      requests: requestRows,
      pending: pendingRows,
      unmatchedIngredients: unmatchedRows,
    },
    telemetry: telemetryRows,
  };
}
