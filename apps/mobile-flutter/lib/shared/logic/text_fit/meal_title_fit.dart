import 'package:flutter/widgets.dart';
import '../../../theme/calm_tokens.dart';
import '../display_format.dart';

/// Stacks kcal only when the title would lose text beside the figure.
bool mealTitleNeedsStack(
  BuildContext context, {
  required double width,
  required String title,
  required String? kcalLabel,
  required int titleMaxLines,
}) {
  final scaler = MediaQuery.textScalerOf(context);
  final direction = Directionality.of(context);
  final kcalPainter = TextPainter(
    text: TextSpan(text: kcalLabel, style: dashBody()),
    textDirection: direction,
    textScaler: scaler,
    maxLines: 1,
  )..layout();
  final titlePainter = TextPainter(
    text: TextSpan(text: capitalizeFirst(title), style: dashBody()),
    textDirection: direction,
    textScaler: scaler,
    maxLines: titleMaxLines,
  )..layout(
    maxWidth: (width - 8 - kcalPainter.width).clamp(0, double.infinity),
  );
  final stacked = titlePainter.didExceedMaxLines;
  kcalPainter.dispose();
  titlePainter.dispose();
  return stacked;
}
