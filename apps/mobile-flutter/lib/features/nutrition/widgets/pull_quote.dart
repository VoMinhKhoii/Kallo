import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import 'fade_in_down.dart';

/// RN port of `apps/mobile/src/components/nutrition/sections/pull-quote.tsx`.
class PullQuote extends StatelessWidget {
  const PullQuote({super.key, required this.card});

  final EducationCardData card;

  @override
  Widget build(BuildContext context) {
    // Web motion.aside opacity/y:8 duration 0.55 delay 0.22.
    return FadeInDown(
      duration: const Duration(milliseconds: 550),
      delay: const Duration(milliseconds: 220),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 3px dashed accent-60 left border.
            const SizedBox(
              width: 3,
              child: CustomPaint(painter: _DashedVerticalPainter()),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('nutrition.pullQuote.eyebrow').toUpperCase(),
                    style: NhamTextStyles.sansBold(fontSize: 10).copyWith(
                      letterSpacing: 2.2,
                      color: NhamColors.stone,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tr(card.titleKey),
                    style: NhamTextStyles.serifItalic(fontSize: 18).copyWith(
                      height: 25 / 18,
                      letterSpacing: -0.09,
                      color: NhamColors.text,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tr(card.bodyKey),
                    style: NhamTextStyles.serifItalic(fontSize: 15).copyWith(
                      height: 28 / 15,
                      color: NhamColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashedVerticalPainter extends CustomPainter {
  const _DashedVerticalPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = NhamColors.accent60
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.square;
    const dash = 5.0;
    const gap = 4.0;
    var y = 0.0;
    final x = size.width / 2;
    while (y < size.height) {
      canvas.drawLine(Offset(x, y), Offset(x, (y + dash).clamp(0, size.height)),
          paint);
      y += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
