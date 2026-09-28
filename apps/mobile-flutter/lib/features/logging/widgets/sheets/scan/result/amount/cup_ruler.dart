import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../../../models/nutrition/vessel.dart';
import '../../../../../logic/portion/portion_anchors.dart';
import '../../../../../logic/portion/vessel_data.dart';
import '../../../../../logic/portion/vessel_glyph_scale.dart';
import '../../../../portion/portion_glyphs.dart';
import '../../../../portion/ruler/portion_ruler_control.dart';

/// The meal card's cup ruler, for a drink's custom amount: the four cups
/// (150 / 250 / 500 / 700 ml) on the same tape, ticks and pointer the portion
/// picker uses. Drag the tape or tap a cup; the Amount row above shows the
/// exact ml and takes typing for anything the cups don't cover.
///
/// No caption under it (owner review): the Amount row already says the number.
class ScanCupRuler extends StatelessWidget {
  const ScanCupRuler({
    super.key,
    required this.ml,
    required this.onChanged,
    this.enabled = true,
  });

  /// False while saving: no drag, no cup tap, no screen-reader adjustment —
  /// the amount being saved must not move under the request.
  final bool enabled;

  /// The approved canvas draws the cups at a little over half the portion
  /// picker's size — the tallest ~74pt — so they sit under the Amount row
  /// without crowding Add meal. The tape and its spacing stay the picker's.
  static const double _glyphScale = 0.55;

  final int ml;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final anchors = buildCupAnchorsMl(context.locale.languageCode);
    final tiers = [
      for (final a in anchors) vesselFamilies[ContainerFamily.cup]![a.tier]!,
    ];
    final ratios = vesselWidthRatios(tiers);
    final envelope = gramEnvelope(anchors);
    final nearest = nearestAnchor(anchors, ml);

    final ruler = PortionRulerControl(
      anchors: anchors,
      grams: ml,
      min: envelope.min,
      max: envelope.max,
      unit: 'ml',
      sliderLabel: 'logging.scan.amount'.tr(),
      valueTextFor: (value) {
        final claimed = claimedAnchor(anchors, value);
        return claimed == null ? '$value ml' : '$value ml — ${claimed.label}';
      },
      glyphBandAspect: vesselBandAspect(tiers, ratios) / _glyphScale,
      glyphBuilder:
          (index, column) => PortionVesselGlyph(
            asset: tiers[index].asset,
            width: column * ratios[index] * _glyphScale,
            label: '${anchors[index].label} (${tiers[index].sizeLabel})',
            selected: anchors[index].tier == nearest.tier,
            onTap: () {
              HapticFeedback.selectionClick();
              onChanged(anchors[index].value.round());
            },
          ),
      labelFor: (index) => tiers[index].sizeLabel,
      onChanged: onChanged,
    );
    return IgnorePointer(
      ignoring: !enabled,
      child: ExcludeSemantics(excluding: !enabled, child: ruler),
    );
  }
}
