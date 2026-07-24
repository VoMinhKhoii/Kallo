import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../data/api_client.dart';
import '../../../shared/widgets/top_toast.dart';
import 'logging_keys.dart';
import 'logging_models.dart';
import 'logging_providers.dart';

const _uuid = Uuid();

/// Persist a saved meal's amount edit (gram overrides + per-row removals), then
/// reconcile the card in place and heal the dashboard surfaces off the new
/// totals. On success: a light haptic + a "Meal updated" top toast. On error: an
/// error top toast, and the exception is rethrown so the editor stays open with
/// its state intact (mirrors the web `useUpdateMeal` + `handleUpdateMeal`).
///
/// The day feed is reconciled in place by id — no refetch — the least-invasive
/// analogue of the web's `upsertById`; the dashboard reads the day off its own
/// bundle so those are invalidated to refetch (via [invalidateMealSurfaces] with
/// `includeDay: false`, since the day itself is reconciled here, not refetched).
Future<void> updatePersistedMeal(
  BuildContext context,
  WidgetRef ref, {
  required String userId,
  required String date,
  required String mealId,
  required List<Map<String, dynamic>> edits,
  required List<String> removeIds,
}) async {
  try {
    final res = await ref
        .read(apiClientProvider)
        .patch<Map<String, dynamic>>(
          '/api/v1/meals/${Uri.encodeComponent(mealId)}',
          {
            if (edits.isNotEmpty) 'edits': edits,
            if (removeIds.isNotEmpty) 'removeIds': removeIds,
          },
        );
    final mealJson = res['meal'] as Map<String, dynamic>?;
    if (mealJson != null) {
      ref
          .read(loggingDayProvider(LoggingDayArgs(userId, date)).notifier)
          .reconcileMeal(PersistedMeal.fromJson(mealJson));
    }
    invalidateMealSurfaces(ref.invalidate, userId, date, includeDay: false);
    if (context.mounted) {
      HapticFeedback.mediumImpact();
      showTopToast(context, 'logging.persistedMealCard.mealUpdated'.tr());
    }
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        'logging.persistedMealCard.updateError'.tr(),
        variant: TopToastVariant.error,
      );
    }
    rethrow;
  }
}

/// "Log again": reproduce a saved meal exactly on the CURRENTLY selected day — a
/// deterministic server-side copy of its stored item rows (no AI re-run), so the
/// accepted numbers and any prior gram edits are preserved verbatim. Mirrors the
/// web `handleLogAgain` + `useDuplicateMeal`: a fresh client uuid is minted for
/// the new meal so the persisted row has a stable id, `POST
/// /api/v1/meals/{id}/duplicate` copies it server-side, and the day feed is then
/// refetched so the copy slots in.
///
/// Reconcile strategy: a re-log is a brand-new meal, so `reconcileMeal` (which
/// only replaces an existing id in place) can't add it — a targeted day refetch
/// is the least-invasive analogue, matching the delete/confirm flows. Every
/// other date-keyed surface is healed via [invalidateMealSurfaces]
/// (`includeDay: false` — the day is refreshed explicitly below).
///
/// Success: a medium haptic + a "Meal saved" top toast (web parity — the web
/// success toast reads `logging.feedArea.savedMeal`). Error: an error top toast.
Future<void> logMealAgain(
  BuildContext context,
  WidgetRef ref, {
  required String userId,
  required String date,
  required String mealId,
}) async {
  try {
    await ref.read(apiClientProvider).post<Map<String, dynamic>>(
      '/api/v1/meals/${Uri.encodeComponent(mealId)}/duplicate',
      {
        'newMealId': _uuid.v4(),
        'loggedDate': date,
        'timezoneOffset': timezoneOffsetMinutes(),
      },
    );
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        'logging.persistedMealCard.logAgainError'.tr(),
        variant: TopToastVariant.error,
      );
    }
    return;
  }

  // The duplicate landed — heal the date-keyed surfaces, then refetch the day so
  // the copied meal appears in the feed. A refetch failure must NOT surface as
  // an error (the meal really was saved); invalidate instead so a later fetch
  // resolves it.
  invalidateMealSurfaces(ref.invalidate, userId, date, includeDay: false);
  try {
    await ref
        .read(loggingDayProvider(LoggingDayArgs(userId, date)).notifier)
        .refresh();
  } catch (_) {
    ref.invalidate(loggingDayProvider(LoggingDayArgs(userId, date)));
  }

  if (context.mounted) {
    HapticFeedback.mediumImpact();
    showTopToast(context, 'logging.feedArea.savedMeal'.tr());
  }
}
