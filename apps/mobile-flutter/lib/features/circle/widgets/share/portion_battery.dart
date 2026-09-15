import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/split_parts.dart';

/// One seat at the table: who they are and how many parts they hold.
@immutable
class PortionSeat {
  const PortionSeat({
    required this.id,
    required this.initials,
    required this.label,
    required this.parts,
    this.colorIndex,
  });

  final String id;

  /// One or two characters drawn inside the pin.
  final String initials;

  /// Spoken by the screen reader — the pin itself is a glyph.
  final String label;

  final int parts;

  /// Which seat colour to wear. Defaults to the seat's position, which is what
  /// the split meter wants; the whole-portion tab sets it explicitly because
  /// each person there sits alone in their own battery.
  final int? colorIndex;
}

/// Seat colours, in the order people join. Seat 0 is always you.
///
/// A deliberate, scoped exception to `mobile.md`'s "no pure red, no pure
/// green": the meter needs six hues that survive being 18pt wide next to each
/// other, and the warm palette cannot supply them. Red sits fifth so it only
/// appears at a five-person table, away from the common cases and away from
/// the × badge it would otherwise read as a warning beside.
const List<Color> kSeatColors = [
  Color(0xFF141413), // you
  Color(0xFF12B76A),
  Color(0xFFFFB020),
  Color(0xFFFF8A6B),
  Color(0xFFF04438),
  Color(0xFF2E90FA),
];

/// Ink or white for initials drawn on [kSeatColors] at the same index.
const List<Color> kSeatInk = [
  Colors.white,
  Colors.white,
  KalloColors.text,
  KalloColors.text,
  Colors.white,
  Colors.white,
];

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

  /// Shell height. The drag band, not just the visual.
  static const double shellHeight = 56;

  /// How far the grip grows past the shell while held, top and bottom.
  static const double gripOverhang = 6;

  /// The touch target, which is independent of the 12pt visual.
  static const double gripTarget = KalloIcons.hit; // 44

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
            _PinRow(
              seats: widget.seats,
              parts: parts,
              totalKcal: widget.totalKcal,
              onRemove: widget.onRemove,
            ),
            SizedBox(
              height: PortionBattery.shellHeight,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        _Shell(seats: widget.seats, parts: parts),
                        if (widget.interactive)
                          for (var b = 0; b < parts.length - 1; b++)
                            _notch(b, parts, trackWidth),
                      ],
                    ),
                  ),
                  const _Nub(),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _notch(int boundary, List<int> parts, double trackWidth) {
    var leftParts = 0;
    for (var i = 0; i <= boundary; i++) {
      leftParts += parts[i];
    }
    final perPart = trackWidth / _dishParts;
    // +6 for the shell's border and padding, so the grip lands on the seam
    // between two cells rather than on the shell's outer edge.
    final centre = 6 + leftParts * perPart;
    final held = _dragging == boundary;

    final seatLeft = widget.seats[boundary];
    final seatRight = widget.seats[boundary + 1];

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
      left: centre - PortionBattery.gripTarget / 2,
      top: -PortionBattery.gripOverhang,
      bottom: -PortionBattery.gripOverhang,
      width: PortionBattery.gripTarget,
      child: Semantics(
        slider: true,
        label: '${seatLeft.label} và ${seatRight.label}',
        value: valueAt(parts),
        increasedValue: valueAt(stepUp),
        decreasedValue: valueAt(stepDown),
        onIncrease: () => _step(boundary, 1),
        onDecrease: () => _step(boundary, -1),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onHorizontalDragStart: (_) => _onDragStart(boundary),
          onHorizontalDragUpdate: (details) {
            final box = context.findRenderObject() as RenderBox?;
            if (box == null) return;
            final local = box.globalToLocal(details.globalPosition);
            _onDragUpdate(boundary, local.dx - 6, trackWidth);
          },
          onHorizontalDragEnd: (_) => _onDragEnd(),
          onHorizontalDragCancel: _onDragEnd,
          child: Center(
            child: AnimatedContainer(
              duration: KalloMotion.press,
              curve: Curves.easeOut,
              width: held ? 14 : 12,
              // At rest the grip is exactly the shell; held, it reaches past
              // it, where no cell gap can follow.
              height: PortionBattery.shellHeight -
                  8 +
                  (held ? PortionBattery.gripOverhang * 2 : 0),
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

/// The battery shell and its coloured cells.
class _Shell extends StatelessWidget {
  const _Shell({required this.seats, required this.parts});

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
      child: Row(children: cells),
    );
  }
}

/// The terminal nub. Decorative, and the reason the control reads as a battery
/// rather than a progress bar — so it is present in every state, read-only
/// included.
class _Nub extends StatelessWidget {
  const _Nub();

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

/// kcal over an inverted water-drop pin, centred on the run it owns.
class _PinRow extends StatelessWidget {
  const _PinRow({
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
