import 'package:flutter/painting.dart';

import '../../models/logging/cheat.dart';
import '../../theme/kallo_colors.dart';

/// Dot/indicator colour per cheat slider axis, so every surface that echoes a
/// slider position — the live card, the persisted recap, and a friend's cheat
/// post in the circle feed — stays in lockstep. Macro axes reuse the shared
/// macro palette; drinks borrows the warm accent.
///
/// Promoted out of `features/logging/widgets/cheat/cheat_slider_card.dart`
/// (556 lines, frozen) when circle became a consumer.
Color cheatSliderColor(CheatSliderKey key) => switch (key) {
  CheatSliderKey.protein => KalloColors.macroProtein,
  CheatSliderKey.carbs => KalloColors.macroCarbs,
  CheatSliderKey.fat => KalloColors.macroFat,
  CheatSliderKey.drinks => KalloColors.accent,
};
