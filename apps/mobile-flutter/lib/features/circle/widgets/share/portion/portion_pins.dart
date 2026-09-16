import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import 'portion_seats.dart';

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
            child: _Pin(
              key: ValueKey('pin-${seats[seat].id}'),
              seat: seats[seat].colorIndex ?? seat,
              initials: seats[seat].initials,
              kcal: totalKcal == null
                  ? null
                  : (totalKcal! * parts[seat] / _dishParts).round(),
              onRemove:
                  seat == 0 || onRemove == null ? null : () => onRemove!(seat),
            ),
          ),
      ],
    );
  }
}

class _Pin extends StatelessWidget {
  const _Pin({
    super.key,
    required this.seat,
    required this.initials,
    required this.kcal,
    required this.onRemove,
  });

  final int seat;
  final String initials;
  final int? kcal;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final color = kSeatColors[seat % kSeatColors.length];
    final ink = kSeatInk[seat % kSeatInk.length];
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (kcal != null)
          Text(
            '$kcal',
            style: dashCaption(color: kInk),
            maxLines: 1,
            overflow: TextOverflow.clip,
          ),
        const SizedBox(height: 6),
        SizedBox(
          width: 34,
          height: 34,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // The drop: a square with three round corners, rotated so the
              // square one points down at the run it labels.
              Transform.rotate(
                angle: -0.785398, // -45°
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: color,
                    border: Border.all(color: KalloColors.elev, width: 2),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(15),
                      topRight: Radius.circular(15),
                      bottomRight: Radius.circular(15),
                    ),
                    boxShadow: const [KalloShadows.sm],
                  ),
                  child: Center(
                    child: Transform.rotate(
                      angle: 0.785398,
                      child: Text(
                        initials,
                        style: dashCaption(color: ink),
                      ),
                    ),
                  ),
                ),
              ),
              if (onRemove != null)
                Positioned(
                  top: -4,
                  right: -4,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onRemove!();
                    },
                    child: Container(
                      width: 18,
                      height: 18,
                      decoration: BoxDecoration(
                        color: KalloColors.elev,
                        shape: BoxShape.circle,
                        border: Border.all(color: KalloColors.border),
                      ),
                      child: const Icon(
                        Icons.close,
                        size: 11,
                        color: KalloColors.textSoft,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}
