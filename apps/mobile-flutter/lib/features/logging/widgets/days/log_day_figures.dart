import 'package:flutter/widgets.dart';

import '../../../../shared/logic/macro_composition.dart';
import '../../../../theme/calm_tokens.dart';

/// A day row's name, macro columns and calories, on one line where they fit
/// and on two where they do not.
///
/// The choice is made from the width alone (the name's column, three macro
/// columns at their widest figure, the widest calories), never from this
/// day's own numbers, so every row in the list makes the same one and their
/// columns line up.
class LogDayFigures extends StatelessWidget {
  const LogDayFigures({
    super.key,
    required this.name,
    required this.grams,
    required this.kcal,
    required this.widestKcal,
  });

  final Widget name;

  /// Gram label per macro key ("P 131g"); a macro not known yet is absent
  /// and its column stays empty.
  final Map<String, String> grams;

  /// Null until known, and for a day with nothing logged.
  final String? kcal;

  /// The longest calories the row has to leave room for.
  final String widestKcal;

  /// The name's column on one line: "Yesterday" with room after it.
  static const double _nameWidth = 92;

  /// A macro's glyph and the space before its figure.
  static const double _glyph = 18;

  /// Clear space after a macro column's widest figure.
  static const double _gap = 12;

  @override
  Widget build(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    double width(String text, TextStyle style) {
      final painter = TextPainter(
        text: TextSpan(text: text, style: style),
        textDirection: Directionality.of(context),
        textScaler: scaler,
        maxLines: 1,
      )..layout();
      final w = painter.width;
      painter.dispose();
      return w;
    }

    final line = scaler.scale(kDashBodySize) * kDashBodyLeading;
    final macros = Row(
      children: [
        for (final key in kCompositionKeys)
          Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              child: grams[key] == null ? null : _macro(key, grams[key]!),
            ),
          ),
      ],
    );
    final total =
        kcal == null ? null : Text(kcal!, style: dashBody(tabular: true));
    return LayoutBuilder(
      builder: (context, box) {
        final nameWidth = scaler.scale(_nameWidth);
        final column = _glyph + width('C 888g', dashCaption()) + _gap;
        final needed =
            nameWidth + 3 * column + width(widestKcal, dashBody(tabular: true));
        if (needed <= box.maxWidth) {
          return SizedBox(
            height: line,
            child: Row(
              children: [
                SizedBox(width: nameWidth, child: name),
                Expanded(child: macros),
                if (total != null) total,
              ],
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: line,
              child: Row(
                children: [Expanded(child: name), if (total != null) total],
              ),
            ),
            const SizedBox(height: 2),
            SizedBox(height: line, child: macros),
          ],
        );
      },
    );
  }

  Widget _macro(String key, String label) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(kMacroIcons[key], size: 14, color: kCompositionColors[key]),
      const SizedBox(width: 4),
      // Caption, as the meal card's legend: three figures and a calorie
      // total share the line with the day's name.
      Text(label, style: dashCaption()),
    ],
  );
}
