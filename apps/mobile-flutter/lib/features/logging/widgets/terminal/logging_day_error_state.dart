import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../logic/logging_spacing.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';

/// Day fetch error: a warm alert card — terracotta `nham-danger` accents on
/// the cream surface (never literal reds, which break the palette on sight) —
/// with a CircleAlert, title/desc, and a retry pill (LoggingDayErrorState).
class LoggingDayErrorState extends StatelessWidget {
  const LoggingDayErrorState({super.key, required this.onRetry});
  final VoidCallback onRetry;

  static const _dangerFill = NhamColors.danger10;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(NhamSpacing.sp6),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 448), // max-w-md
          padding: LoggingSpacing.card,
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg), // 2xl
            border: Border.all(color: NhamColors.borderSoft),
            boxShadow: const [NhamShadows.sm],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 2), // mt-0.5
                child: Icon(
                  LucideIcons.circleAlert300, // lucide AlertCircle
                  size: 20,
                  color: NhamColors.danger,
                ),
              ),
              const SizedBox(width: NhamSpacing.sp3), // gap-3
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'logging.feedArea.loadErrorTitle'.tr(),
                      style: dashBody(weight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4), // mt-1
                    Text(
                      'logging.feedArea.loadErrorDescription'.tr(),
                      style: dashMeta(),
                    ),
                    const SizedBox(height: NhamSpacing.sp3), // mt-3
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
          borderRadius: BorderRadius.circular(NhamRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.refreshCw300, // lucide RefreshCw
              size: 16,
              color: NhamColors.danger,
            ),
            const SizedBox(width: NhamSpacing.sp2), // gap-2
            Text(
              'logging.feedArea.retryDay'.tr(),
              style: dashBody(
                color: NhamColors.danger,
                weight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
