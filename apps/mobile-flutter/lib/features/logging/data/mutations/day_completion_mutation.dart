import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/http/api_client.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../logging_keys.dart';
import '../logging_providers.dart';

/// "Mình ăn đủ rồi" — attest that an under-logged day is everything the user
/// actually ate, so it rejoins the trends at its real calories.
///
/// One-way, so there is no optimistic flip to roll back: the day is refetched
/// and the server's `markedComplete` is what takes the notice down. That costs
/// one round trip on a rare, deliberate tap and removes any chance of the UI
/// claiming an attestation the server never stored.
///
/// The dashboard and nutrition surfaces read completeness off their own
/// bundles, so they are invalidated too — otherwise the heatmap would keep
/// showing the day as set aside until something else refetched it.
///
/// True once the server stored the mark; a failure has already been toasted.
///
/// Reads through the [ProviderContainer], not the caller's `WidgetRef`: the
/// caller may be a sheet the user swipes away mid-request, and a disposed ref
/// would throw on the invalidation AFTER the mark was stored — leaving every
/// surface stale and toasting a failure that did not happen.
Future<bool> markDayComplete(
  BuildContext context, {
  required String userId,
  required String date,
}) async {
  final scope = ProviderScope.containerOf(context, listen: false);
  try {
    await scope.read(apiClientProvider).post<Map<String, dynamic>>(
      '/api/v1/logging/day/complete',
      {'date': date, 'timezoneOffset': timezoneOffsetMinutes()},
    );
    invalidateMealSurfaces(scope.invalidate, userId, date);
    if (context.mounted) {
      HapticFeedback.mediumImpact();
    }
    return true;
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        'logging.feedArea.partialDayNotice.markError'.tr(),
        variant: TopToastVariant.error,
      );
    }
    return false;
  }
}
