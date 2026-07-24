import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

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
                  Expanded(child: _RetryButton(onTap: onRetry)),
                  const SizedBox(width: NhamSpacing.sp2),
                  _DiscardButton(onTap: onDiscard),
                ] else
                  // Non-retryable: only Discard, stretched to fill the row.
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: _DiscardButton(onTap: onDiscard),
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

/// Primary "Try again" — solid umber, mirroring the confirm button's resting
/// look (an honest re-run of the same meal).
class _RetryButton extends StatefulWidget {
  const _RetryButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_RetryButton> createState() => _RetryButtonState();
}

class _RetryButtonState extends State<_RetryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.failedAttempt.tryAgain'.tr(),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.btnHover : NhamColors.btn,
            borderRadius: BorderRadius.circular(NhamRadii.xl),
            boxShadow: [_pressed ? NhamShadows.md : NhamShadows.sm],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.refreshCw, size: 14, color: Colors.white),
              const SizedBox(width: 6),
              NhamText(
                'logging.failedAttempt.tryAgain'.tr(),
                variant: NhamTextVariant.body,
                style: dashBody(color: Colors.white, weight: FontWeight.w500),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Quiet "Discard" — wires the previously-unused logging.discard string.
class _DiscardButton extends StatefulWidget {
  const _DiscardButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_DiscardButton> createState() => _DiscardButtonState();
}

class _DiscardButtonState extends State<_DiscardButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.discard'.tr(),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.xl),
          ),
          child: NhamText(
            'logging.discard'.tr(),
            variant: NhamTextVariant.body,
            style: dashBody(color: kInkMuted, weight: FontWeight.w500),
          ),
        ),
      ),
    );
  }
}
