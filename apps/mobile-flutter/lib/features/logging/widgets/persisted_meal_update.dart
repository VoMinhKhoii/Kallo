import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../dashboard/data/dashboard_providers.dart' as dash;
import '../data/logging_models.dart';
import '../data/logging_providers.dart';

/// Persist a saved meal's amount edit (gram overrides + per-row removals), then
/// reconcile the card in place and heal the dashboard surfaces off the new
/// totals. On success: a light haptic + a "Meal updated" top toast. On error: an
/// error top toast, and the exception is rethrown so the editor stays open with
/// its state intact (mirrors the web `useUpdateMeal` + `handleUpdateMeal`).
///
/// The day feed is reconciled in place by id — no refetch — the least-invasive
/// analogue of the web's `upsertById`; the dashboard reads the day off its own
/// bundle so those are invalidated to refetch.
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
    ref.invalidate(mealDatesProvider(userId));
    ref.invalidate(dash.dashboardBundleProvider((userId: userId, date: date)));
    ref.invalidate(dash.dashboardDayProvider((userId: userId, date: date)));
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
