import 'package:flutter/material.dart';

import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import 'portion_battery.dart' show PortionBattery;
import 'portion_seats.dart';

/// The battery shell and its coloured cells.
class BatteryShell extends StatelessWidget {
  const BatteryShell({super.key, required this.seats, required this.parts});

  final List<PortionSeat> seats;
  final List<int> parts;

  @override
  Widget build(BuildContext context) {
    final cells = <Widget>[];
    for (var seat = 0; seat < parts.length; seat++) {
      final color =
          kSeatColors[(seats[seat].colorIndex ?? seat) % kSeatColors.length];
      for (var i = 0; i < parts[seat]; i++) {
        cells.add(
          Expanded(
            key: ValueKey('cell-${seats[seat].id}-$i'),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
            ),
          ),
        );
      }
    }
    return Container(
      height: PortionBattery.shellHeight,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.xl),
        border: Border.all(color: KalloColors.text, width: 2),
      ),
      // STRETCH, not the default centre: a DecoratedBox with no child takes
      // its height from its constraints, and a centred Row hands its children
      // a LOOSE height — so every cell collapsed to zero and the meter painted
      // an empty shell. Assertions could not see it (the widgets are all in the
      // tree at zero height); the render did.
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: cells,
      ),
    );
  }
}

/// The terminal nub. Decorative, and the reason the control reads as a battery
/// rather than a progress bar — so it is present in every state, read-only
/// included.
class BatteryNub extends StatelessWidget {
  const BatteryNub({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 5,
      height: 20,
      margin: const EdgeInsets.only(left: 3),
      decoration: const BoxDecoration(
        color: KalloColors.text,
        borderRadius: BorderRadius.horizontal(right: Radius.circular(3)),
      ),
    );
  }
}
