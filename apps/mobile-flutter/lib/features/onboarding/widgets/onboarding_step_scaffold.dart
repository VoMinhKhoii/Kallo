import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/widgets/mascot/bun_mascot.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import '../data/constants.dart';
import '../logic/onboarding_step_spec.dart';
import 'backdrop/backdrop_slice.dart';
import 'backdrop/step_backdrop.dart';
import 'onboarding_step_header.dart';
import 'onboarding_step_transition.dart';

/// The onboarding's PERSISTENT chrome, and the one thing that slides inside it.
///
/// Everything here except the content region is mounted once and never rebuilt
/// across the six screens: the gradient backdrop, the header (wordmark and the
/// progress bar that fills across it), the bun with its bubble, and the black
/// CTA pinned to the bottom. Only [OnboardingStepSpec.title] and the body under
/// it travel — see [OnboardingStepTransition] for why.
///
/// Two of the fixtures MORPH rather than hold still. The bubble retypes its new
/// line (the mascot resets its typewriter on a `speech` change) and its height
/// change is animated instead of jumping, so the title below it is never
/// shoved. The CTA cross-fades its label ("Continue" → "Save my plan") and
/// fades between enabled and disabled.
///
/// The CTA OVERLAYS the content rather than sitting beside it in the Column, so
/// a long list (screen 2's A–Z countries) genuinely runs under the button and
/// fades out behind it. A Column would have stopped the list dead above the
/// button, and a list that ends on a hard edge reads as "that is all there is".
///
/// The band under the CTA is a [BackdropSlice] rather than a flat canvas fill:
/// it has to hide the content scrolling behind it WITHOUT cutting a rectangle
/// out of the [StepBackdrop]'s blobs. Its own top edge ramps in over
/// [fadeHeight], which is what dissolves the last of the list — and over a
/// screen with nothing more to show it is the same pixels over themselves, so
/// it costs nothing to leave on.
class OnboardingStepScaffold extends StatelessWidget {
  const OnboardingStepScaffold({
    super.key,
    required this.screen,
    required this.spec,
    required this.direction,
    this.busy = false,
    this.onContinue,
    this.onBack,
    this.onSkip,
  });

  /// 1-based wizard screen, out of [kOnboardingScreenCount]. It keys the
  /// content region, so each screen gets a fresh scroll offset and fresh field
  /// controllers instead of inheriting the last one's.
  final int screen;

  final OnboardingStepSpec spec;

  /// +1 walking forward, -1 walking Back — the sweep mirrors with it.
  final int direction;

  /// Null disables the CTA (screen 3 with an out-of-range metric).
  final VoidCallback? onContinue;
  final bool busy;

  /// Screen 1 pops the wizard instead; every other screen goes back one.
  final VoidCallback? onBack;

  /// Absent on screen 1 — a language has to be chosen.
  final VoidCallback? onSkip;

  /// Button (50) + the gap under it, ABOVE the bottom inset.
  static const double ctaReserve = 50 + KalloSpacing.sp3;
  static const double fadeHeight = 40;

  @override
  Widget build(BuildContext context) {
    // The band runs to the PHYSICAL bottom edge, so the button on it carries
    // the home indicator's inset itself.
    final inset = MediaQuery.viewPaddingOf(context).bottom;
    return LayoutBuilder(
      builder: (context, box) => Stack(
        children: [
          const Positioned.fill(child: StepBackdrop()),
          // Only the chrome is inset, and only at the top: the band below it
          // reaches the screen's bottom edge on purpose.
          SafeArea(
            bottom: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Edge to edge: the header insets its own row so the chevron
                // glyph lands on the gutter the title below it starts on.
                OnboardingStepHeader(
                  step: screen,
                  total: kOnboardingScreenCount,
                  progressLabel: tr(
                    'onboarding.stepOf',
                    namedArgs: {
                      'current': '$screen',
                      'total': '$kOnboardingScreenCount',
                    },
                  ),
                  onBack: onBack,
                  onSkip: onSkip,
                  skipLabel: onSkip == null ? null : tr('common.skip'),
                ),
                const SizedBox(height: KalloSpacing.sp3),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: KalloSpacing.sp6,
                    ),
                    child: _guideAndContent(box.biggest, inset),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _guideAndContent(Size field, double inset) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      // A longer line grows the bubble; unanimated, that shove lands on the
      // title in one frame. NOT clipped — the bubble's tail and its shadow
      // both live outside its box, and clipping them would change how the
      // band reads at rest, not just mid-morph.
      AnimatedSize(
        duration: KalloMotion.quick,
        curve: KalloEase.standard,
        alignment: Alignment.topCenter,
        clipBehavior: Clip.none,
        child: BunMascot(speech: tr('onboarding.guide.step$screen')),
      ),
      const SizedBox(height: KalloSpacing.sp3),
      Expanded(child: _body(field, inset)),
    ],
  );

  /// [field] is the whole SCREEN's box — the same one the [StepBackdrop]
  /// behind it fills, which the CTA band needs to line its own copy of the
  /// blobs up with it. So the band reaches the screen's bottom edge too, and
  /// carries [inset] under the button instead of stopping short of it.
  Widget _body(Size field, double inset) => Stack(
    children: [
      Positioned.fill(
        child: OnboardingStepTransition(
          direction: direction,
          child: KeyedSubtree(key: ValueKey(screen), child: _content(inset)),
        ),
      ),
      Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: BackdropSlice(
          field: field,
          fadeHeight: fadeHeight,
          child: Padding(
            padding: EdgeInsets.only(
              top: fadeHeight,
              bottom: KalloSpacing.sp3 + inset,
            ),
            child: KalloButton(
              title: spec.ctaLabel,
              animateTitle: true,
              variant: KalloButtonVariant.cta,
              loading: busy,
              disabled: onContinue == null,
              onPressed: onContinue,
            ),
          ),
        ),
      ),
    ],
  );

  /// The sliding region: the title, then the screen's own controls under it in
  /// a scroll view that starts at the top on every screen.
  Widget _content(double inset) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(spec.title, style: kPageTitle()),
      const SizedBox(height: KalloSpacing.sp3),
      Expanded(
        child: SingleChildScrollView(
          primary: false,
          padding: EdgeInsets.only(bottom: ctaReserve + inset),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: spec.body,
        ),
      ),
    ],
  );
}
