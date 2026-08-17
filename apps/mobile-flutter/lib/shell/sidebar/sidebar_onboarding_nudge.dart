import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/onboarding/providers/onboarding_providers.dart';
import '../../theme/calm_tokens.dart';
import '../../theme/kallo_colors.dart';
import '../../theme/kallo_theme.dart';

/// Mobile onboarding nudge — the drawer's one attention object: a white card
/// with an accent ring, a step counter, title, description, progress bar and
/// the umber CTA.
///
/// On the calm scale like everything else: Body 14 for the title, Meta 12 for
/// the counter and description, `kInk`/`kInkMuted` only. It kept a 10px
/// uppercase eyebrow and a 13px body at 1.65 leading long after the rest of
/// the app moved — three sizes none of which were on the scale, and the loose
/// leading that made every surface read padded.
///
/// The ring stays: this is a nudge, not a data card, and the accent hairline
/// is what separates it from the nav rows above it. The umber CTA stays too —
/// it is the single primary action on the surface, which is exactly what the
/// umber is reserved for.
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
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(kCardRadius),
        color: KalloColors.elev,
        border: Border.all(color: const Color(0x40C9A87C), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr(
              'app.onboardingNudge.stepCounter',
              namedArgs: {'current': '$safeStep', 'total': '$_total'},
            ),
            style: dashMeta(),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Text(
            tr('app.onboardingNudge.title'),
            // Medium, not semibold — 500 is the weight ceiling; Be Vietnam
            // Pro reads heavy above it.
            style: dashBody(weight: FontWeight.w500),
          ),
          const SizedBox(height: KalloSpacing.sp1),
          Text(
            tr('app.onboardingNudge.description'),
            style: dashMeta(),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          ClipRRect(
            borderRadius: BorderRadius.circular(KalloRadii.pill),
            child: Container(
              height: 4,
              color: KalloColors.borderBiscotti40,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeOut,
                    width: constraints.maxWidth * progressPct,
                    decoration: BoxDecoration(
                      color: KalloColors.accent,
                      borderRadius: BorderRadius.circular(KalloRadii.pill),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          NudgeCta(onTap: onResume),
        ],
      ),
    );
  }
}

/// Umber CTA inside the nudge — full-width, radius 8, Body 14 medium in white,
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
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp3,
          vertical: KalloSpacing.sp2,
        ),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _pressed ? KalloColors.btnHover : KalloColors.btn,
          borderRadius: BorderRadius.circular(KalloRadii.md),
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
          style: dashBody(color: Colors.white, weight: FontWeight.w500),
        ),
      ),
    );
  }
}
