import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/nutrition/vessel.dart';
import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/portion_display.dart';
import '../portion/portion_container_body.dart';
import '../portion/portion_piece_body.dart';

/// The Size row of a dish with a vessel, its ruler always open beneath it: the
/// owner ruled there is no tap to reach the vessels (2026-11-09). The ruler is
/// the app's own tape — the bowls ride the scale under a fixed needle — and it
/// writes grams like Amount does.
class MealEditSizeRow extends StatelessWidget {
  const MealEditSizeRow({
    super.key,
    required this.vessel,
    required this.grams,
    required this.onGrams,
  });

  final ClientVessel vessel;
  final double grams;
  final ValueChanged<int> onGrams;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode == 'vi' ? 'vi' : 'en';
    final label = portionDisplayFor(vessel, grams.round(), locale).label;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Row(
            children: [
              Text('logging.mealEdit.size'.tr(), style: dashBody()),
              const SizedBox(width: KalloSpacing.sp3),
              Expanded(
                child: Text(
                  capitalizeFirst(label),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                  style: dashBody(color: kInkMuted),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: KalloSpacing.sp3),
          child: _ruler(locale),
        ),
      ],
    );
  }

  Widget _ruler(String locale) {
    final anchors = buildAnchors(vessel, locale);
    final envelope = gramEnvelope(anchors);
    final at = grams.round().clamp(envelope.min, envelope.max);
    final title = 'logging.portionPicker.title'.tr();
    return switch (vessel) {
      final ContainerVessel v => PortionContainerBody(
        family: v.family,
        anchors: anchors,
        grams: at,
        min: envelope.min,
        max: envelope.max,
        sliderLabel: title,
        onChanged: onGrams,
      ),
      final PieceVessel v => PortionPieceBody(
        vessel: v,
        anchors: anchors,
        grams: at,
        min: envelope.min,
        max: envelope.max,
        sliderLabel: title,
        onChanged: onGrams,
      ),
    };
  }
}
