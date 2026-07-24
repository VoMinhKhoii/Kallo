import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../data/api_client.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../dashboard/data/dashboard_providers.dart' as dash;
import '../data/logging_keys.dart';
import '../data/logging_providers.dart';

const _uuid = Uuid();

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
/// is the least-invasive analogue, matching the delete/confirm flows. The
/// meal-dates strip + dashboard bundle/day are invalidated the way
/// `persisted_meal_update.dart` does, so every date-keyed surface heals off the
/// new totals.
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
  ref.invalidate(mealDatesProvider(userId));
  ref.invalidate(dash.dashboardBundleProvider((userId: userId, date: date)));
  ref.invalidate(dash.dashboardDayProvider((userId: userId, date: date)));
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
