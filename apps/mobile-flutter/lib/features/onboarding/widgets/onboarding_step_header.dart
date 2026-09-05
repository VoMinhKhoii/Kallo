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
class OnboardingStepHeader extends StatelessWidget {
  const OnboardingStepHeader({
    super.key,
    required this.step,
    required this.total,
    required this.progressLabel,
    this.onBack,
    this.onSkip,
    this.skipLabel,
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

  static const double barHeight = 4;
  static const double wordmarkHeight = WordmarkBar.wordmarkHeight;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          WordmarkBar(
            leading: onBack == null ? null : _back(context),
            trailing: onSkip == null || skipLabel == null
                ? null
                // The slack is on the LEFT of the label: it buys the skip
                // target room without moving the label off the gutter.
                : MetaAction(
                    label: skipLabel!,
                    onTap: onSkip,
                    padding: const EdgeInsets.only(left: KalloSpacing.sp3),
                  ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          _bar(),
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
                    // `heightFactor` is load-bearing: an Align hands its child
                    // LOOSE constraints, and a childless ColoredBox under a
                    // loose height takes the smallest one it is offered — the
                    // fill painted `fraction` wide and 0 tall, so every step's
                    // bar looked empty.
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
