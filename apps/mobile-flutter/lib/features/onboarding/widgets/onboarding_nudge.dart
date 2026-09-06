import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/constants.dart';
import '../providers/onboarding_draft_providers.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// Mobile onboarding nudge — the top card in Settings (it lived in the retired
/// drawer): a white card with an accent ring, a step counter, title,
/// description, progress bar and one CTA.
///
/// On the calm scale like everything else: Body 14 for the title, Meta 12 for
/// the counter and description, `kInk`/`kInkMuted` only. It kept a 10px
/// uppercase eyebrow and a 13px body at 1.65 leading long after the rest of
/// the app moved — three sizes none of which were on the scale, and the loose
/// leading that made every surface read padded.
///
/// It shares the grouped cards' metrics (`kCardRadius` 22, 16 padding) so it
/// reads as the first card of the same list. The ring is the ONE thing that
/// separates it: this is a nudge, not a data card. The CTA is an ordinary
/// in-app primary — beige [KalloButton] — since the native pass reserved umber
/// for toggles and progress fills, and its own progress bar is already umber's
/// job on this very card.
class OnboardingNudge extends ConsumerWidget {
  const OnboardingNudge({required this.onResume, super.key});

  final VoidCallback onResume;

  /// The counter names WIZARD screens, not server steps: the card is a link
  /// into the wizard, so "Step 3 of 6" has to match the header the tap opens.
  static const int _total = kOnboardingScreenCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rawStep = ref.watch(onboardingResumeScreenProvider);
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
          KalloButton(
            title: tr('app.onboardingNudge.cta'),
            onPressed: onResume,
          ),
        ],
      ),
    );
  }
}

