import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';

/// Day fetch error: a warm alert card — terracotta `nham-danger` accents on
/// the cream surface (never literal reds, which break the palette on sight) —
/// with a CircleAlert, title/desc, and a retry pill (LoggingDayErrorState).
class LoggingDayErrorState extends StatelessWidget {
  const LoggingDayErrorState({super.key, required this.onRetry});
  final VoidCallback onRetry;

  static const _dangerFill = Color(0x1AD37B69); // nham-danger @ 10%

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(NhamSpacing.sp6),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 448), // max-w-md
          padding: const EdgeInsets.all(NhamSpacing.sp4), // p-4
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
                  LucideIcons.circleAlert, // lucide AlertCircle
                  size: 20,
                  color: NhamColors.danger,
                ),
              ),
              const SizedBox(width: NhamSpacing.sp3), // gap-3
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    NhamText(
                      'logging.feedArea.loadErrorTitle'.tr(),
                      variant: NhamTextVariant.small,
                      style: dashBody(weight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4), // mt-1
                    NhamText(
                      'logging.feedArea.loadErrorDescription'.tr(),
                      variant: NhamTextVariant.small,
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
              LucideIcons.refreshCw, // lucide RefreshCw
              size: 16,
              color: NhamColors.danger,
            ),
            const SizedBox(width: NhamSpacing.sp2), // gap-2
            NhamText(
              'logging.feedArea.retryDay'.tr(),
              variant: NhamTextVariant.small,
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
