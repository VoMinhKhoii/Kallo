import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import 'dashed_border_painter.dart';

/// A dashed (dotted) 1px border panel: rounded-[28px], bg #FFFCF8, p-5.
class DottedBorderBox extends StatelessWidget {
  const DottedBorderBox({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: DashedBorderPainter(color: KalloColors.inputBorder, radius: 28),
      child: Container(
        padding: const EdgeInsets.all(KalloSpacing.sp5),
        decoration: BoxDecoration(
          color: KalloColors.cardCream, // #FFFCF8
          borderRadius: BorderRadius.circular(28),
        ),
        child: child,
      ),
    );
  }
}
