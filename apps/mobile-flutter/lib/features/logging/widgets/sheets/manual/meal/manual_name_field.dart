import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../shared/widgets/form/kallo_text_field.dart';
import '../../../../logic/manual/manual_amount.dart';
import '../../../../../../theme/calm_tokens.dart';

/// "Meal name" over an optional pill field. Its placeholder IS the default —
/// the ingredient names joined with " + " — so leaving it blank shows exactly
/// the title the meal will be logged under.
class ManualNameField extends StatelessWidget {
  const ManualNameField({
    super.key,
    required this.controller,
    required this.defaultTitle,
    this.enabled = true,
  });

  final TextEditingController controller;

  /// "Ức gà + Cơm trắng"; empty before anything is added.
  final String defaultTitle;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
          child: Text(
            'logging.manualLogging.mealName'.tr(),
            style: kGroupLabel(),
          ),
        ),
        Semantics(
          textField: true,
          label: 'logging.manualLogging.mealName'.tr(),
          child: KalloTextField(
            controller: controller,
            enabled: enabled,
            maxLength: manualNameMaxLength,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.done,
            hintText:
                defaultTitle.isEmpty
                    ? 'logging.manualLogging.mealNameEmpty'.tr()
                    : defaultTitle,
          ),
        ),
      ],
    );
  }
}
