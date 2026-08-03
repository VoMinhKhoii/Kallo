import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/vessel.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/portion_display.dart';
import 'portion_readout.dart';
import 'portion_ruler.dart';

/// The piece branch: readout above the ruler (the silhouettes are the labels),
/// and the claimed tier name — or "Custom portion" — beneath it.
class PortionPieceBody extends StatelessWidget {
  const PortionPieceBody({
    super.key,
    required this.vessel,
    required this.anchors,
    required this.grams,
    required this.min,
    required this.max,
    required this.kcal,
    required this.sliderLabel,
    required this.onChanged,
  });

  final PieceVessel vessel;
  final List<PortionAnchor> anchors;
  final int grams;
  final int min;
  final int max;
  final double kcal;
  final String sliderLabel;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final claimed = claimedAnchor(anchors, grams);
    final prefix = countPrefixFor(vessel);
    final claimedName = claimed == null ? null : '$prefix${claimed.label}';

    return Column(
      children: [
        PortionReadout(grams: grams, kcal: kcal),
        const SizedBox(height: NhamSpacing.sp3),
        PortionRuler(
          anchors: anchors,
          countPrefix: prefix,
          claimedTier: claimed?.tier,
          grams: grams,
          min: min,
          max: max,
          kind: vessel.kind,
          sliderLabel: sliderLabel,
          sliderValueText: claimedName == null
              ? '$grams g'
              : '$grams g — $claimedName',
          onChanged: onChanged,
        ),
        const SizedBox(height: NhamSpacing.sp2),
        // No fixed height. Both states are one line of the same style, so the
        // sheet can't jump between them anyway — and an 18pt box clipped the
        // descenders off "phần lớn" once Dynamic Type pushed the line to 19.5.
        Text(
          claimedName ?? 'logging.portionPicker.custom'.tr(),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: dashMeta(
            weight: claimedName != null ? FontWeight.w500 : FontWeight.w400,
          ),
        ),
      ],
    );
  }
}
