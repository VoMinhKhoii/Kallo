import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import 'fade_in_down.dart';

/// RN port of `apps/mobile/src/components/nutrition/states/empty-state.tsx`.
class EmptyState extends StatefulWidget {
  const EmptyState({super.key});

  @override
  State<EmptyState> createState() => _EmptyStateState();
}

class _EmptyStateState extends State<EmptyState> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // Web motion.section opacity/y:8 duration 0.55 delay 0.1.
    return FadeInDown(
      duration: const Duration(milliseconds: 550),
      delay: const Duration(milliseconds: 100),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SeedMark(),
            const SizedBox(height: 24),
            Text(
              tr('nutrition.emptyV2.title'),
              style: NhamTextStyles.serifMedium(fontSize: 24).copyWith(
                height: 30 / 24,
                letterSpacing: -0.36,
                color: NhamColors.text,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              tr('nutrition.emptyV2.description'),
              style: dashBody(color: kInkMuted).copyWith(height: 28 / 14),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (_) => setState(() => _pressed = true),
              onTapUp: (_) => setState(() => _pressed = false),
              onTapCancel: () => setState(() => _pressed = false),
              onTap: () => context.go('/logging'),
              child: Opacity(
                opacity: _pressed ? 0.9 : 1,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: NhamColors.text,
                    borderRadius: BorderRadius.circular(9999),
                  ),
                  child: Text(
                    tr('nutrition.emptyV2.logMeal'),
                    style: dashBody(
                      weight: FontWeight.w500,
                      color: NhamColors.surface,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The 56x56 sprouting-seed line mark (RN inline SVG → CustomPaint).
class _SeedMark extends StatelessWidget {
  const _SeedMark();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 56,
      height: 56,
      child: CustomPaint(painter: _SeedMarkPainter()),
    );
  }
}

class _SeedMarkPainter extends CustomPainter {
  const _SeedMarkPainter();

  @override
  void paint(Canvas canvas, Size size) {
    // Leaf outline.
    final outline = Path()
      ..moveTo(28, 8)
      ..cubicTo(36, 14, 40, 22, 40, 30)
      ..cubicTo(40, 40, 33, 48, 28, 48)
      ..cubicTo(23, 48, 16, 40, 16, 30)
      ..cubicTo(16, 22, 20, 14, 28, 8)
      ..close();
    final outlinePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.25
      ..strokeJoin = StrokeJoin.round
      ..color = NhamColors.textMuted.withValues(alpha: 0.55);
    canvas.drawPath(outline, outlinePaint);

    // Dashed central vein.
    final veinPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..strokeCap = StrokeCap.round
      ..color = NhamColors.textMuted.withValues(alpha: 0.45);
    const dash = 2.0;
    const gap = 3.0;
    var y = 16.0;
    while (y < 46) {
      canvas.drawLine(Offset(28, y), Offset(28, (y + dash).clamp(0, 46)),
          veinPaint);
      y += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
