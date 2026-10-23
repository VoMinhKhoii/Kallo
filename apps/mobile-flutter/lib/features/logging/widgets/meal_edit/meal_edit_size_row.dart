import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/nutrition/vessel.dart';
import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/portion_display.dart';
import '../portion/portion_container_body.dart';
import '../portion/portion_piece_body.dart';

/// The Size row of a dish with a vessel, and the ruler it drops open in place.
///
/// A dropdown, not a second sheet level: the owner ruled the size control
/// opens under its row (2026-10-22). The ruler is the app's own tape — the
/// bowls ride the scale under a fixed needle — so it reads exactly as the
/// portion picker always has, and it writes grams like Amount does.
class MealEditSizeRow extends StatelessWidget {
  const MealEditSizeRow({
    super.key,
    required this.vessel,
    required this.grams,
    required this.open,
    required this.onToggle,
    required this.onGrams,
  });

  final ClientVessel vessel;
  final double grams;
  final bool open;
  final VoidCallback onToggle;
  final ValueChanged<int> onGrams;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode == 'vi' ? 'vi' : 'en';
    final label = portionDisplayFor(vessel, grams.round(), locale).label;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          expanded: open,
          child: InkWell(
            onTap: onToggle,
            splashFactory: NoSplash.splashFactory,
            highlightColor: KalloColors.hover40,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Row(
                children: [
                  Text('logging.mealEdit.size'.tr(), style: dashBody()),
                  const SizedBox(width: KalloSpacing.sp3),
                  // The value hugs the chevron, as in an iOS settings row. It
                  // used to share the row half-and-half with the label, so a
                  // short tier name started mid-row instead of at the right.
                  Expanded(
                    child: Text(
                      capitalizeFirst(label),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.end,
                      style: dashBody(color: kInkMuted),
                    ),
                  ),
                  const SizedBox(width: KalloSpacing.sp1),
                  AnimatedRotation(
                    turns: open ? 0.5 : 0,
                    duration: KalloMotion.disclosure,
                    curve: KalloEase.enter,
                    child: Icon(
                      LucideIcons.chevronDown300,
                      size: 18,
                      color: kInkMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        AnimatedSize(
          duration: KalloMotion.disclosure,
          curve: KalloEase.enter,
          alignment: Alignment.topCenter,
          child:
              open
                  ? Padding(
                    padding: const EdgeInsets.only(bottom: KalloSpacing.sp3),
                    child: _ruler(locale),
                  )
                  : const SizedBox(width: double.infinity),
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
