import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';

/// The quiet Cancel text button — exits the amount editor without a network
/// call. Disabled (null onTap) while a save is in flight.
class AmountEditorCancelButton extends StatelessWidget {
  const AmountEditorCancelButton({super.key, required this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      child: NhamText(
        'logging.persistedMealCard.cancelEdit'.tr(),
        variant: NhamTextVariant.body,
        style: dashBody(color: kInkMuted),
      ),
    );
  }
}

/// The primary Save button — a warm-hover pill that shows a spinner + "Saving…"
/// while [saving], and dims to 0.6 when disabled (every row removed, or saving).
class AmountEditorSaveButton extends StatelessWidget {
  const AmountEditorSaveButton({
    super.key,
    required this.saving,
    required this.enabled,
    required this.onTap,
  });

  final bool saving;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.6,
      child: Material(
        color: NhamColors.hover,
        borderRadius: BorderRadius.circular(NhamRadii.xl),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(NhamRadii.xl),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (saving) ...[
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: NhamColors.text,
                    ),
                  ),
                  const SizedBox(width: 6),
                ],
                NhamText(
                  saving
                      ? 'logging.persistedMealCard.savingEdit'.tr()
                      : 'logging.persistedMealCard.saveEdit'.tr(),
                  variant: NhamTextVariant.body,
                  style:
                      dashBody(color: NhamColors.text, weight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
