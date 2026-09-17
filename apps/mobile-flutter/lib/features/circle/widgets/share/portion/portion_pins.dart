import 'package:flutter/material.dart';

import '../../portion/portion_seats.dart';
import 'portion_pin.dart';

/// kcal over an inverted water-drop pin, centred on the run it owns.
class PortionPinRow extends StatelessWidget {
  const PortionPinRow({
    super.key,
    required this.seats,
    required this.parts,
    required this.totalKcal,
    required this.onRemove,
  });

  final List<PortionSeat> seats;
  final List<int> parts;
  final double? totalKcal;
  final ValueChanged<int>? onRemove;

  int get _dishParts => parts.reduce((a, b) => a + b);

  int _colorOf(int seat) => seats[seat].colorIndex ?? seat;

  @override
  Widget build(BuildContext context) {
    // Deliberately NOT a fixed height: the kcal line grows with Dynamic Type
    // (clamped at 1.3x app-wide), and a fixed lane overflows the moment it does.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var seat = 0; seat < parts.length; seat++)
          Expanded(
            flex: parts[seat],
            child: PortionPin(
              key: ValueKey('pin-${seats[seat].id}'),
              seat: _colorOf(seat),
              profile: seats[seat].profile,
              initials: seats[seat].initials,
              kcal:
                  totalKcal == null
                      ? null
                      : (totalKcal! * parts[seat] / _dishParts).round(),
              // Colour 0 is always you, and you cannot remove yourself. Keyed on
              // colour rather than position so a lone seat in a whole-portion
              // battery (position 0, anyone) still gets its ×.
              onRemove:
                  _colorOf(seat) == 0 || onRemove == null
                      ? null
                      : () => onRemove!(seat),
            ),
          ),
      ],
    );
  }
}
