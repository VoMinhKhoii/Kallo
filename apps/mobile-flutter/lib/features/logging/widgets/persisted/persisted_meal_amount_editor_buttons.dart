import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/quiet_action_button.dart';
import '../../../../theme/calm_tokens.dart';

/// The quiet Cancel text button — exits the amount editor without a network
/// call. Disabled (null onTap) while a save is in flight.
class AmountEditorCancelButton extends StatelessWidget {
  const AmountEditorCancelButton({super.key, required this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      child: Text(
        'logging.persistedMealCard.cancelEdit'.tr(),
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
    return QuietActionButton(
      label: 'logging.persistedMealCard.saveEdit'.tr(),
      busyLabel: 'logging.persistedMealCard.savingEdit'.tr(),
      busy: saving,
      enabled: enabled,
      onTap: onTap,
    );
  }
}
