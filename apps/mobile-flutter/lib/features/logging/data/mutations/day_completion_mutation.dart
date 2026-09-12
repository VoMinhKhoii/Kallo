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
Future<void> markDayComplete(
  BuildContext context,
  WidgetRef ref, {
  required String userId,
  required String date,
}) async {
  try {
    await ref.read(apiClientProvider).post<Map<String, dynamic>>(
      '/api/v1/logging/day/complete',
      {'date': date, 'timezoneOffset': timezoneOffsetMinutes()},
    );
    invalidateMealSurfaces(ref.invalidate, userId, date);
    if (context.mounted) {
      HapticFeedback.mediumImpact();
    }
  } catch (_) {
    if (context.mounted) {
      showTopToast(
        context,
        'logging.feedArea.partialDayNotice.markError'.tr(),
        variant: TopToastVariant.error,
      );
    }
  }
}
