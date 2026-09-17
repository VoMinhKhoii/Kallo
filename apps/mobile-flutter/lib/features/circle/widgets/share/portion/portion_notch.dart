import 'package:flutter/material.dart';

import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_motion.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/split_parts.dart';
import '../../portion/portion_metrics.dart';
import '../../portion/portion_seats.dart';

/// One draggable boundary between two runs.
///
/// The grip is the only thing in the control that spans the full shell height:
/// a 12pt bar inset among 12pt cell gaps disappears into the pattern, so at
/// rest it is flush top and bottom, and while held it grows past the shell
/// where nothing else reaches. The hit box is 44pt regardless.
class PortionNotch extends StatelessWidget {
  const PortionNotch({
    super.key,
    required this.boundary,
    required this.parts,
    required this.seats,
    required this.trackWidth,
    required this.held,
    required this.onDragStart,
    required this.onDragUpdate,
    required this.onDragEnd,
    required this.onStep,
  });

  final int boundary;
  final List<int> parts;
  final List<PortionSeat> seats;
  final double trackWidth;
  final bool held;
  final VoidCallback onDragStart;

  /// Local x within the track, in logical pixels from its left edge.
  final ValueChanged<double> onDragUpdate;
  final VoidCallback onDragEnd;

  /// +1 or -1, from the screen reader's increase/decrease.
  final ValueChanged<int> onStep;

  int get _dishParts => parts.reduce((a, b) => a + b);

  @override
  Widget build(BuildContext context) {
    var leftParts = 0;
    for (var i = 0; i <= boundary; i++) {
      leftParts += parts[i];
    }
    final perPart = trackWidth / _dishParts;
    // +6 for the shell's border and padding, so the grip lands on the seam
    // between two cells rather than on the shell's outer edge.
    final centre = 6 + leftParts * perPart;
    
    final seatLeft = seats[boundary];
    final seatRight = seats[boundary + 1];

    /// Spoken state one part either way. Flutter ASSERTS that a node carrying
    /// increase/decrease also carries increasedValue/decreasedValue — without
    /// them the widget crashes in debug the moment VoiceOver reaches it, which
    /// is exactly the audience it exists for. `portion_ruler_control.dart`
    /// learned this first.
    String valueAt(List<int> p) =>
        '${seatLeft.label} ${p[boundary]} phần, '
        '${seatRight.label} ${p[boundary + 1]} phần';
    var leftEnd = 0;
    for (var i = 0; i <= boundary; i++) {
      leftEnd += parts[i];
    }
    final stepUp = partsAfterDrag(
      parts: parts,
      boundary: boundary,
      desiredLeftEnd: leftEnd + 1,
    );
    final stepDown = partsAfterDrag(
      parts: parts,
      boundary: boundary,
      desiredLeftEnd: leftEnd - 1,
    );

    return Positioned(
      left: centre - PortionMetrics.gripTarget / 2,
      top: -PortionMetrics.gripOverhang,
      bottom: -PortionMetrics.gripOverhang,
      width: PortionMetrics.gripTarget,
      child: Semantics(
        slider: true,
        label: '${seatLeft.label} và ${seatRight.label}',
        value: valueAt(parts),
        increasedValue: valueAt(stepUp),
        decreasedValue: valueAt(stepDown),
        onIncrease: () => onStep(1),
        onDecrease: () => onStep(-1),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onHorizontalDragStart: (_) => onDragStart(),
          onHorizontalDragUpdate: (details) {
            final box = context.findRenderObject() as RenderBox?;
            if (box == null) return;
            // Local to the NOTCH, so re-origin against its own left edge: the
            // grip is centred on the boundary and the box is the 44pt target.
            final local = box.globalToLocal(details.globalPosition);
            onDragUpdate(
              centre + local.dx - PortionMetrics.gripTarget / 2 - 6,
            );
          },
          onHorizontalDragEnd: (_) => onDragEnd(),
          onHorizontalDragCancel: onDragEnd,
          child: Center(
            child: AnimatedContainer(
              duration: KalloMotion.press,
              curve: Curves.easeOut,
              width: held ? 14 : 12,
              // At rest the grip is exactly the shell; held, it reaches past
              // it, where no cell gap can follow.
              height: PortionMetrics.shellHeight -
                  8 +
                  (held ? PortionMetrics.gripOverhang * 2 : 0),
              decoration: BoxDecoration(
                color: KalloColors.elev,
                borderRadius: BorderRadius.circular(KalloRadii.pill),
                border: Border.all(color: KalloColors.text, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0x2B141413),
                    blurRadius: held ? 10 : 4,
                    offset: Offset(0, held ? 3 : 1),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
