import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shared/widgets/typography/meta_action.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';

/// The chrome every onboarding step wears: the app's [WordmarkBar] — back
/// chevron left, the wordmark centred, "Skip" right — over a 4px progress bar.
///
/// It renders EDGE TO EDGE and insets itself: the wordmark row sits at
/// [WordmarkBar.rowInset], which puts the chevron's GLYPH on the content
/// gutter rather than 10pt inboard of it; the bar keeps that gutter.
class OnboardingStepHeader extends StatelessWidget {
  const OnboardingStepHeader({
    super.key,
    required this.step,
    required this.total,
    required this.progressLabel,
    this.onBack,
    this.onSkip,
    this.skipLabel,
    this.gutter = KalloSpacing.sp6,
  });

  /// 1-based; the bar fills `step / total`.
  final int step;
  final int total;

  /// "Step 3 of 6" — localized by the caller, read out on the bar.
  final String progressLabel;

  /// Absent on the first step; the chevron is not rendered at all.
  final VoidCallback? onBack;

  /// Absent on a step that must be answered.
  final VoidCallback? onSkip;
  final String? skipLabel;

  /// The CONTENT gutter the progress bar lines up with. The wordmark row does
  /// not use it — it sits at [WordmarkBar.rowInset] and pays the slack back
  /// out of its own inset, which is what puts the chevron GLYPH on the line
  /// the title below it starts on.
  final double gutter;

  static const double barHeight = 4;
  static const double wordmarkHeight = WordmarkBar.wordmarkHeight;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          WordmarkBar(
            gutterInset: WordmarkBar.rowInset,
            leading: onBack == null ? null : _back(context),
            trailing: onSkip == null || skipLabel == null
                ? null
                // Slack on both sides of the label: the left buys the skip
                // target room, the right stands the label off the screen edge
                // at 16 (4 of inset + 12 of padding).
                : MetaAction(
                    label: skipLabel!,
                    onTap: onSkip,
                    padding: const EdgeInsets.symmetric(
                      horizontal: KalloSpacing.sp3,
                    ),
                  ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: gutter),
            child: _bar(),
          ),
        ],
      );

  Widget _back(BuildContext context) => Semantics(
        button: true,
        label: Localizations.of<MaterialLocalizations>(
                context, MaterialLocalizations)
            ?.backButtonTooltip,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onBack,
          child: const SizedBox(
            width: KalloIcons.hit,
            height: KalloIcons.hit,
            child: Icon(
              LucideIcons.chevronLeft300,
              size: KalloIcons.primary,
              color: kInk,
            ),
          ),
        ),
      );

  Widget _bar() => Semantics(
        label: progressLabel,
        excludeSemantics: true,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(barHeight / 2),
          child: SizedBox(
            height: barHeight,
            child: ColoredBox(
              color: KalloColors.track,
              child: TweenAnimationBuilder<double>(
                duration: KalloMotion.emphasis,
                curve: KalloEase.standard,
                tween: Tween(end: (step / total).clamp(0.0, 1.0)),
                builder: (context, fraction, child) => Align(
                  alignment: Alignment.centerLeft,
                  child: FractionallySizedBox(
                    widthFactor: fraction,
                    // `heightFactor` is load-bearing: Align hands its child
                    // LOOSE constraints, and a childless ColoredBox then takes
                    // the smallest height offered — a bar 0pt tall.
                    heightFactor: 1,
                    child: child,
                  ),
                ),
                // Constant across every frame of the fill — built once.
                child: const ColoredBox(color: KalloColors.btn),
              ),
            ),
          ),
        ),
      );
}
