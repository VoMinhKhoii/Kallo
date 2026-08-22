/// What the dock needs off the user's profile row.
///
/// Its own file because it is a data contract, not a widget: the screen builds
/// it, the pager threads it through, and the section reads it. Three consumers
/// and no rendering of its own.
library;

import '../../../../models/nutrition/nutrition_enums.dart';

/// Per-screen dock targets (profile values, with the web DEFAULT_PROFILE
/// fallbacks applied by the screen).
class DockTargets {
  const DockTargets({
    required this.calorieTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
    this.goal,
  });

  /// Which way the dial's figures count. Not a target, but it comes off the
  /// same profile row and only the dock reads it.
  final MacroGoal? goal;

  final double calorieTarget;
  final double proteinTargetG;
  final double carbsTargetG;
  final double fatTargetG;
}
