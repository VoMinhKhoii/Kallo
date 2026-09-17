import 'package:flutter/material.dart';

import '../../portion/portion_cells.dart';
import '../../portion/portion_metrics.dart';
import '../../portion/portion_seats.dart';

/// The meter's shell: a [BatteryFrame] holding one [PortionRun] per seat.
///
/// Barely more than a translation from seats to runs now — the drawing itself
/// is shared with the recipient's readout, so the two cannot drift.
class BatteryShell extends StatelessWidget {
  const BatteryShell({super.key, required this.seats, required this.parts});

  final List<PortionSeat> seats;
  final List<int> parts;

  @override
  Widget build(BuildContext context) {
    return BatteryFrame(
      height: PortionMetrics.shellHeight,
      child: PortionCells(
        runs: [
          for (var seat = 0; seat < parts.length; seat++)
            PortionRun(
              color:
                  kSeatColors[(seats[seat].colorIndex ?? seat) %
                      kSeatColors.length],
              parts: parts[seat],
              key: seats[seat].id,
            ),
        ],
      ),
    );
  }
}
