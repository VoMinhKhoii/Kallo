import 'package:flutter/painting.dart';

import '../../models/logging/cheat.dart';
import '../../theme/kallo_colors.dart';

/// Dot/indicator colour per cheat slider axis, so the two surfaces that echo a
/// slider position — the live card and the owner's expanded details — stay in
/// lockstep. Macro axes reuse the shared macro palette; drinks borrows the
/// warm accent.
///
/// Both consumers are in `features/logging/`, so by colocate-then-promote this
/// belongs there rather than here. It was pulled out of
/// `features/logging/widgets/cheat/cheat_slider_card.dart` for a circle-feed
/// recap that has since been dropped, and it cannot go home: that file is
/// frozen at 524 lines and `logging/logic/` is at the ten-file cap, so either
/// move trades this misplacement for a gate failure. Left here deliberately,
/// said out loud rather than dressed up as a shared primitive.
Color cheatSliderColor(CheatSliderKey key) => switch (key) {
  CheatSliderKey.protein => KalloColors.macroProtein,
  CheatSliderKey.carbs => KalloColors.macroCarbs,
  CheatSliderKey.fat => KalloColors.macroFat,
  CheatSliderKey.drinks => KalloColors.accent,
};
