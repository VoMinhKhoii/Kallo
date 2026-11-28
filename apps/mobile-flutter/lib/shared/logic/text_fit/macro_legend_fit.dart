import 'package:flutter/widgets.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// Measures the single-line legend including optional calorie figures.
double macroLegendWidth(
  BuildContext context, {
  required Map<String, String> gramLabels,
  required Widget? leading,
  required Widget? trailing,
  required int childCount,
}) {
  double textWidth(String text, TextStyle style) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: DefaultTextStyle.of(context).style.merge(style),
      ),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final totalWidth = painter.width;
    painter.dispose();
    return totalWidth;
  }

  double extraWidth(Widget? widget) =>
      widget is Text
          ? textWidth(widget.data ?? '', widget.style ?? dashBody())
          : 0;
  final totalWidth =
      gramLabels.values.fold<double>(
        0,
        (sum, label) => sum + 18 + textWidth(label, dashCaption()),
      ) +
      extraWidth(leading) +
      extraWidth(trailing) +
      (childCount - 1) * KalloSpacing.sp3;
  return totalWidth;
}
