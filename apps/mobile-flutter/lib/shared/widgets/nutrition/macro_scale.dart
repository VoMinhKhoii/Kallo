/// The macro figures that sit under a [CompositionBar]: a food glyph in each
/// macro's pigment, then its grams.
///
/// Promoted out of the Circle feed when the dashboard dock became its second
/// consumer. The two surfaces show the same three numbers under the same bar,
/// and a meal has to read identically whether you are looking at your own dock
/// or at a friend's post.
///
/// The three sit at evenly-surrounded positions rather than tracking the bar's
/// segment widths. Mirroring the flex weights read well on an even split and
/// fell apart on a lopsided one: a 7%-protein meal gives a ~22pt cell that
/// cannot hold "P 4g", so the label scaled toward illegible while the far one
/// jammed against the edge. A figure the reader cannot read is worth less than
/// one that has moved away from its colour — the pigment on each glyph is what
/// still ties a figure to its segment.
library;

import 'package:flutter/material.dart';

import '../../logic/macro_composition.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

class MacroScale extends StatelessWidget {
  const MacroScale({required this.macros, super.key});

  /// The same record [compositionFromGrams] takes, so a row drawing both reads
  /// one shape. Null is a macro that was never measured, and shows as an em
  /// dash rather than a confident zero.
  final MacroGrams macros;

  static String _grams(double? value) =>
      value == null ? '—' : '${value.round()}g';

  static String _labelFor(String key) => switch (key) {
    'protein' => 'P',
    'carbohydrate' => 'C',
    _ => 'F',
  };

  double? _gramsFor(String key) => switch (key) {
    'protein' => macros.protein,
    'carbohydrate' => macros.carbohydrate,
    _ => macros.fat,
  };

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
    children: [
      for (final key in kCompositionKeys)
        _MacroValue(
          icon: kMacroIcons[key]!,
          color: kCompositionColors[key]!,
          label: _labelFor(key),
          value: _grams(_gramsFor(key)),
        ),
    ],
  );
}

/// One macro: its food glyph in the macro's own pigment, then the grams. The
/// glyph sits at 14 — the in-text-run exception to the app-wide 24 — because it
/// reads as punctuation inside the line, not as an icon beside it.
class _MacroValue extends StatelessWidget {
  const _MacroValue({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 14, color: color),
      const SizedBox(width: KalloSpacing.sp1_5),
      // Ink, not muted. These are the post's actual data — muted at 12 put
      // them below the timestamp in prominence, which is backwards. Size still
      // separates them from the calorie figure, so colour need not as well.
      Text('$label $value', style: dashMeta(color: kInk, tabular: true)),
    ],
  );
}
