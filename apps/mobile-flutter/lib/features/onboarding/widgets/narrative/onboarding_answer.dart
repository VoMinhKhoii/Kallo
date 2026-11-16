import 'package:flutter/widgets.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../logic/onboarding_step_spec.dart';
import '../backdrop/backdrop_slice.dart';
import '../onboarding_step_content.dart';
import '../onboarding_step_transition.dart';

/// The CTA overlays the content rather than sitting beside it in the Column,
/// so a long list (screen 2's A–Z countries) genuinely runs under the button and
/// fades out behind it. A Column would stop the list dead above the button,
/// and a list ending on a hard edge reads as "that is all there is".
///
/// The band under the CTA is a BackdropSlice rather than a flat canvas fill:
/// it hides scrolling content without cutting a rectangle out of StepBackdrop's
/// blobs. Its top edge ramps in over 40pt, dissolving the last of the list.
/// With nothing more to show it is the same pixels over themselves, so it
/// costs nothing to leave on.
class OnboardingAnswer extends StatelessWidget {
  const OnboardingAnswer({
    super.key,
    required this.field,
    required this.inset,
    required this.screen,
    required this.spec,
    required this.direction,
    required this.busy,
    this.onContinue,
    this.onBack,
  });

  /// The whole screen's box, matching StepBackdrop behind it so the CTA
  /// band aligns its copy of the blobs. The band reaches the physical bottom
  /// and carries the home indicator's inset below its button.
  final Size field;
  final double inset;
  final int screen;
  final OnboardingStepSpec spec;
  final int direction;
  final bool busy;
  final VoidCallback? onContinue;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned.fill(
        child: OnboardingStepTransition(
          direction: direction,
          child: KeyedSubtree(
            key: ValueKey(screen),
            // Inside the keyed subtree: the swipe commits by threshold, so
            // there is no in-flight state to carry across a screen change, and
            // mounting per screen means the callback is always the current
            // screen's.
            child: OnboardingStepContent(
              spec: spec,
              bottomInset: 62 + inset,
              onBack: onBack,
            ),
          ),
        ),
      ),
      Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: BackdropSlice(
          field: field,
          fadeHeight: 40,
          child: Padding(
            padding: EdgeInsets.only(top: 40, bottom: 12 + inset),
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
}
