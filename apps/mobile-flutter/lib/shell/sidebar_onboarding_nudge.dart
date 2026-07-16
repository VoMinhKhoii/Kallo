import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/onboarding/providers/onboarding_providers.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import '../theme/nham_typography.dart';

/// Mobile onboarding nudge — gradient surface (accent/10 → surface → hover/55),
/// 16px radius, accent@25 ring, p-16, step counter, title (12px), description
/// (11px), 1px progress bar (accent over border/40), umber CTA.
class OnboardingNudge extends ConsumerWidget {
  const OnboardingNudge({required this.onResume, super.key});

  final VoidCallback onResume;

  static const int _total = 3;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rawStep = ref.watch(onboardingResumeStepProvider);
    final safeStep = rawStep.clamp(1, _total);
    final completed = (safeStep - 1).clamp(0, _total);
    final progressPct = completed / _total;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NhamRadii.xxl),
        color: NhamColors.elev,
        border: Border.all(color: const Color(0x40C9A87C), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr(
              'app.onboardingNudge.stepCounter',
              namedArgs: {'current': '$safeStep', 'total': '$_total'},
            ).toUpperCase(),
            style: NhamTextStyles.sansMedium(
              fontSize: NhamFontSize.eyebrow,
            ).copyWith(
              color: NhamColors.textMuted,
              letterSpacing: NhamTracking.wide,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            tr('app.onboardingNudge.title'),
            style: NhamTextStyles.sansSemiBold(
              fontSize: NhamFontSize.sm,
              height: NhamLeading.snug,
            ).copyWith(color: NhamColors.text),
          ),
          const SizedBox(height: 4),
          Text(
            tr('app.onboardingNudge.description'),
            style: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.detail,
              height: NhamLeading.relaxed,
            ).copyWith(color: NhamColors.textMuted),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(NhamRadii.pill),
            child: Container(
              height: 4,
              color: NhamColors.borderBiscotti40,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeOut,
                    width: constraints.maxWidth * progressPct,
                    decoration: BoxDecoration(
                      color: NhamColors.accent,
                      borderRadius: BorderRadius.circular(NhamRadii.pill),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          NudgeCta(onTap: onResume),
        ],
      ),
    );
  }
}

/// Umber CTA inside the nudge — full-width, radius 8, 11px medium white label,
/// btn→btnHover press shift over ~150ms.
class NudgeCta extends StatefulWidget {
  const NudgeCta({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  State<NudgeCta> createState() => _NudgeCtaState();
}

class _NudgeCtaState extends State<NudgeCta> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeInOut,
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.btnHover : NhamColors.btn,
          borderRadius: BorderRadius.circular(NhamRadii.md),
          boxShadow: const [
            BoxShadow(
              color: Color(0x33695E4E),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          tr('app.onboardingNudge.cta'),
          style: NhamTextStyles.sansSemiBold(
            fontSize: NhamFontSize.detail,
          ).copyWith(color: Colors.white),
        ),
      ),
    );
  }
}
