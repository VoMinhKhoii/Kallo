import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import 'terminal_card_buttons.dart';

/// A failed analysis, rendered as a feed card so the attempt is never lost: the
/// raw input as a Lora quote, a terracotta one-liner, and "Try again" as the
/// primary action (with a quiet Discard). The raw text is also restored to the
/// composer — this card is the visible record of what happened.
class FailedAttemptCard extends StatelessWidget {
  const FailedAttemptCard({
    super.key,
    required this.rawInput,
    required this.retryable,
    required this.onRetry,
    required this.onDiscard,
  });

  final String rawInput;

  /// When false (a non-retryable server error), the card offers only Discard —
  /// re-running the same input would just fail again.
  final bool retryable;
  final VoidCallback onRetry;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
      child: Container(
        padding: const EdgeInsets.all(NhamSpacing.sp4),
        decoration: BoxDecoration(
          color: NhamColors.elev,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          border: Border.all(color: NhamColors.borderSoft),
          boxShadow: const [NhamShadows.sm],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NhamText(
              rawInput,
              variant: NhamTextVariant.mealQuote,
              style: const TextStyle(fontSize: 17, height: 28 / 17),
            ),
            const SizedBox(height: NhamSpacing.sp3),
            NhamText(
              'logging.failedAttempt.message'.tr(),
              variant: NhamTextVariant.small,
              style: dashMeta(color: NhamColors.danger),
            ),
            const SizedBox(height: NhamSpacing.sp4),
            Row(
              children: [
                if (retryable) ...[
                  Expanded(
                    child: TerminalPrimaryButton(
                      icon: LucideIcons.refreshCw,
                      label: 'logging.failedAttempt.tryAgain'.tr(),
                      onTap: onRetry,
                    ),
                  ),
                  const SizedBox(width: NhamSpacing.sp2),
                  TerminalDiscardButton(onTap: onDiscard),
                ] else
                  // Non-retryable: only Discard, stretched to fill the row.
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: TerminalDiscardButton(onTap: onDiscard),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
