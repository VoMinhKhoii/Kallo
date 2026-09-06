import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/widgets/mascot/bun_mascot.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../data/constants.dart';
import 'backdrop/backdrop_slice.dart';
import 'backdrop/step_backdrop.dart';
import 'onboarding_step_header.dart';

/// The shape every onboarding screen wears: the gradient backdrop, header, the
/// bun's guide band, the page title, the screen's own content, and one black
/// CTA pinned to the bottom.
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
    required this.title,
    required this.child,
    required this.ctaLabel,
    this.onContinue,
    this.busy = false,
    this.onBack,
    this.onSkip,
  });

  /// 1-based wizard screen, out of [kOnboardingScreenCount].
  final int screen;

  final String title;
  final Widget child;
  final String ctaLabel;

  /// Null disables the CTA (screen 3 with an out-of-range metric).
  final VoidCallback? onContinue;
  final bool busy;

  /// Screen 1 pops the wizard instead; every other screen goes back one.
  final VoidCallback? onBack;

  /// Absent on screen 1 — a language has to be chosen.
  final VoidCallback? onSkip;

  /// Button (50) + the gap under it. Content scrolls behind this much.
  static const double ctaReserve = 50 + KalloSpacing.sp3;
  static const double fadeHeight = 40;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder:
          (context, box) => Stack(
            children: [
              const Positioned.fill(child: StepBackdrop()),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: KalloSpacing.sp6,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                    BunMascot(speech: tr('onboarding.guide.step$screen')),
                    const SizedBox(height: KalloSpacing.sp3),
                    Text(title, style: kPageTitle()),
                    const SizedBox(height: KalloSpacing.sp3),
                    Expanded(child: _body(box.biggest)),
                  ],
                ),
              ),
            ],
          ),
    );
  }

  /// [field] is the whole scaffold's box — the same one the [StepBackdrop]
  /// behind it fills, which the CTA band needs in order to line its own copy
  /// of the blobs up with it.
  Widget _body(Size field) => Stack(
    children: [
      Positioned.fill(
        child: SingleChildScrollView(
          primary: false,
          padding: const EdgeInsets.only(bottom: ctaReserve),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: child,
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
            padding: const EdgeInsets.only(
              top: fadeHeight,
              bottom: KalloSpacing.sp3,
            ),
            child: KalloButton(
              title: ctaLabel,
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
}
