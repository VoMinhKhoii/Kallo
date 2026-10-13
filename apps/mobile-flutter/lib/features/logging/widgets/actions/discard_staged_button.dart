import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'confirm_meal_removal.dart';
import 'meal_action_icon_button.dart';

/// The way out of an unsaved card: a quiet trash, asked once, then handed to
/// [onDiscard]. Shared by the staged card in the day's list and the answer
/// revealed in the footer — the same meal at two points in its life.
class DiscardStagedButton extends StatelessWidget {
  const DiscardStagedButton({
    super.key,
    required this.busy,
    required this.onDiscard,
  });

  /// Inert while a confirm is in flight: the row is about to become a saved
  /// meal, and deleting it mid-flight would race that.
  final bool busy;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) => MealActionIconButton(
    icon: LucideIcons.trash2300,
    label: 'logging.stagedMealCard.discard'.tr(),
    danger: true,
    onTap:
        busy
            ? null
            : () async {
              if (await confirmPendingDiscard(context) && context.mounted) {
                onDiscard();
              }
            },
  );
}
