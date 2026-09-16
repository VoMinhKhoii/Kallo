import 'package:flutter/material.dart';

import '../../../../../theme/kallo_colors.dart';

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
