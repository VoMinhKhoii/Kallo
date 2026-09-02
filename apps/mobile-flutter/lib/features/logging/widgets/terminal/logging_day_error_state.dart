import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../logic/logging_spacing.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// Day fetch error: a warm alert card — terracotta `kallo-danger` accents on
/// the cream surface (never literal reds, which break the palette on sight) —
/// with a CircleAlert, title/desc, and a retry pill (LoggingDayErrorState).
class LoggingDayErrorState extends StatelessWidget {
  const LoggingDayErrorState({super.key, required this.onRetry});
  final VoidCallback onRetry;

  static const _dangerFill = KalloColors.danger10;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(KalloSpacing.sp6),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 448), // max-w-md
          padding: LoggingSpacing.card,
          decoration: BoxDecoration(
            color: KalloColors.elev,
            borderRadius: BorderRadius.circular(KalloRadii.card),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 2), // mt-0.5
                child: Icon(
                  LucideIcons.circleAlert300, // lucide AlertCircle
                  size: 20,
                  color: KalloColors.danger,
                ),
              ),
              const SizedBox(width: KalloSpacing.sp3), // gap-3
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'logging.feedArea.loadErrorTitle'.tr(),
                      style: dashBody(),
                    ),
                    const SizedBox(height: 4), // mt-1
                    Text(
                      'logging.feedArea.loadErrorDescription'.tr(),
                      style: dashMeta(),
                    ),
                    const SizedBox(height: KalloSpacing.sp3), // mt-3
                    _RetryPill(onRetry: onRetry),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RetryPill extends StatelessWidget {
  const _RetryPill({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onRetry,
      child: Container(
        constraints: const BoxConstraints(minHeight: 36), // min-h-9
        padding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 8,
        ), // px-3.5 py-2
        decoration: BoxDecoration(
          color: LoggingDayErrorState._dangerFill,
          borderRadius: BorderRadius.circular(KalloRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.refreshCw300, // lucide RefreshCw
              size: 16,
              color: KalloColors.danger,
            ),
            const SizedBox(width: KalloSpacing.sp2), // gap-2
            Text(
              'logging.feedArea.retryDay'.tr(),
              style: dashBody(
                color: KalloColors.danger,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
