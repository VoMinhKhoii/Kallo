import 'package:flutter/widgets.dart';

import '../../../../theme/kallo_theme.dart';

/// The dimensions every portion surface shares.
///
/// These used to hang off `PortionBattery` as statics, which meant the shell
/// and the notch imported the control they are parts OF — a cycle that made
/// either one impossible to reuse without dragging the whole meter along.
/// They are measurements, so they belong to the vocabulary, not to one widget.
abstract final class PortionMetrics {
  /// The interactive meter's shell. Also its drag band, not just its look.
  static const double shellHeight = 56;

  /// The read-only readout's shell — a label, not a target.
  static const double readoutHeight = 30;

  /// How far the grip grows past the shell while held, top and bottom.
  static const double gripOverhang = 6;

  /// The grip's touch target, independent of its 12pt visual.
  static const double gripTarget = KalloIcons.hit;
}
