import 'package:flutter/material.dart';

import '../../../../../theme/kallo_theme.dart';
import '../../../logic/split_parts.dart';
import 'portion_battery.dart';
import 'portion_seats.dart';

/// The whole-portion tab's meter: one FULL battery per person.
///
/// A divided bar would lie here — nothing is being split, so nothing is drawn
/// split. Each battery holds `kTotalParts ~/ n` cells so a cell is exactly the
/// width it is on the split meter, which is what lets the two states morph into
/// each other instead of cross-fading.
class WholePortionBatteries extends StatelessWidget {
  const WholePortionBatteries({
    super.key,
    required this.seats,
    required this.totalKcal,
  });

  final List<PortionSeat> seats;
  final double? totalKcal;

  @override
  Widget build(BuildContext context) {
    final per = kTotalParts ~/ seats.length;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var seat = 0; seat < seats.length; seat++) ...[
          if (seat > 0) const SizedBox(width: KalloSpacing.sp3),
          Expanded(
            child: PortionBattery(
              key: ValueKey('whole-${seats[seat].id}'),
              // A party of one, holding the whole of its own battery.
              seats: [
                PortionSeat(
                  id: seats[seat].id,
                  initials: seats[seat].initials,
                  label: seats[seat].label,
                  parts: per,
                  colorIndex: seat,
                ),
              ],
              totalKcal: totalKcal,
              interactive: false,
            ),
          ),
        ],
      ],
    );
  }
}
