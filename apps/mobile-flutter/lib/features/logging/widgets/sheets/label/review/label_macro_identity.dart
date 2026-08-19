import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../theme/nham_colors.dart';

/// Icon + colour per macro, borrowed wholesale from the nutrition page's legend
/// (`features/nutrition/widgets/day_summary.dart`): beef, wheat, and a drop of
/// oil for fat, which has no single ingredient the way the other two do.
///
/// The colours are the CHARTED set, not `NhamColors.macro*`. `nham_colors.dart`
/// is explicit that the two must not be merged: the quiet tan/taupe/grey trio
/// turns to mud when the three sit side by side, which is exactly this row.
///
/// Lives here rather than in `logic/label_nutrients.dart` so that file stays
/// pure Dart — same split the nutrition page uses.
class LabelMacroIdentity {
  const LabelMacroIdentity(this.icon, this.color);

  final IconData icon;
  final Color color;
}

const Map<String, LabelMacroIdentity> labelMacroIdentities = {
  'calories': LabelMacroIdentity(LucideIcons.flame300, NhamColors.accent),
  'proteinGrams': LabelMacroIdentity(
    LucideIcons.beef300,
    NhamColors.chartProtein,
  ),
  'carbsGrams': LabelMacroIdentity(LucideIcons.wheat300, NhamColors.chartCarbs),
  'fatGrams': LabelMacroIdentity(LucideIcons.droplet300, NhamColors.chartFat),
};
