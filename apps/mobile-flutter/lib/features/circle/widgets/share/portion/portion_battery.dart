import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../logic/split_parts.dart';
import 'portion_battery_shell.dart';
import 'portion_notch.dart';
import 'portion_pins.dart';
import '../../portion/portion_metrics.dart';
import '../../portion/portion_seats.dart';


/// The portion battery: a dish divided into [kTotalParts] cells, one coloured
/// run per person, a draggable pill notch on every internal boundary, and a
/// pin above each run carrying that person's kcal.
///
/// The grip is the only thing in the control that spans the full shell height —
/// a 12pt bar inset among 12pt cell gaps disappears into the pattern, so at
/// rest it is flush top and bottom, and on touch it grows past the shell where
/// nothing else reaches.
///
/// Set [interactive] to false for the recipient's read-only copy: the notches
/// and their gesture handling disappear entirely rather than being disabled.
class PortionBattery extends StatefulWidget {
  const PortionBattery({
    super.key,
    required this.seats,
    required this.totalKcal,
    this.onChanged,
    this.onRemove,
    this.interactive = true,
  });

  final List<PortionSeat> seats;

  /// Whole-dish calories, used for the per-pin readout.
  final double? totalKcal;

  /// Fires with the full new run list whenever a notch settles on a new part.
  final ValueChanged<List<int>>? onChanged;

  /// Tapping a pin's × removes that seat. Null hides every badge — seat 0
  /// never gets one regardless, because you cannot remove yourself.
  final ValueChanged<int>? onRemove;

  final bool interactive;


  @override
  State<PortionBattery> createState() => _PortionBatteryState();
}

class _PortionBatteryState extends State<PortionBattery> {
  /// Which boundary is under a finger, or null.
  int? _dragging;

  /// Parts as they stand mid-drag. Null when not dragging, so an outside
  /// change (someone added or removed) always wins.
  List<int>? _draft;

  List<int> get _parts =>
      _draft ?? widget.seats.map((s) => s.parts).toList(growable: false);

  /// The dish as drawn — kTotalParts on the split meter, one battery's own
  /// cell count on the whole-portion tab.
  int get _dishParts => _parts.reduce((a, b) => a + b);

  void _onDragStart(int boundary) {
    HapticFeedback.lightImpact();
    setState(() {
      _dragging = boundary;
      _draft = _parts;
    });
  }

  void _onDragUpdate(int boundary, double localX, double trackWidth) {
    final perPart = trackWidth / _dishParts;
    if (perPart <= 0) return;
    final desired = (localX / perPart).round();
    final next = partsAfterDrag(
      parts: _parts,
      boundary: boundary,
      desiredLeftEnd: desired,
    );
    if (_listEquals(next, _parts)) return;
    // One tick per part crossed — the same cue the app gives every other
    // discrete selection change.
    HapticFeedback.selectionClick();
    setState(() => _draft = next);
    widget.onChanged?.call(next);
  }

  void _onDragEnd() {
    setState(() {
      _dragging = null;
      _draft = null;
    });
  }

  /// Nudge a boundary one part, for the screen reader's increase/decrease.
  void _step(int boundary, int direction) {
    var leftEnd = 0;
    for (var i = 0; i <= boundary; i++) {
      leftEnd += _parts[i];
    }
    final next = partsAfterDrag(
      parts: _parts,
      boundary: boundary,
      desiredLeftEnd: leftEnd + direction,
    );
    if (_listEquals(next, _parts)) {
      // Refused at the floor — the app's cue for rejected input.
      HapticFeedback.heavyImpact();
      return;
    }
    HapticFeedback.selectionClick();
    widget.onChanged?.call(next);
  }

  static bool _listEquals(List<int> a, List<int> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final parts = _parts;
    return LayoutBuilder(
      builder: (context, constraints) {
        // The nub rides outside the shell, so the track is what is left.
        const nubWidth = 5.0 + 3.0;
        final shellWidth = constraints.maxWidth - nubWidth;
        // Cells sit inside the shell's 2pt border and 4pt padding.
        final trackWidth = shellWidth - (2 + 4) * 2;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PortionPinRow(
              seats: widget.seats,
              parts: parts,
              totalKcal: widget.totalKcal,
              onRemove: widget.onRemove,
            ),
            SizedBox(
              height: PortionMetrics.shellHeight,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        BatteryShell(seats: widget.seats, parts: parts),
                        if (widget.interactive)
                          for (var b = 0; b < parts.length - 1; b++)
                            PortionNotch(
                              boundary: b,
                              parts: parts,
                              seats: widget.seats,
                              trackWidth: trackWidth,
                              held: _dragging == b,
                              onDragStart: () => _onDragStart(b),
                              onDragUpdate: (x) =>
                                  _onDragUpdate(b, x, trackWidth),
                              onDragEnd: _onDragEnd,
                              onStep: (d) => _step(b, d),
                            ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

}
