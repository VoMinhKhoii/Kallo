import 'package:flutter/widgets.dart';
import '../../../../shell/window/window_layout.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../logic/onboarding_step_spec.dart';
import '../backdrop/backdrop_slice.dart';
import '../onboarding_step_content.dart';
import '../onboarding_step_transition.dart';

/// The answer scrolls beneath an aligned copy of the full-window backdrop.
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
            child: OnboardingStepContent(
              spec: spec,
              showTitle: !WindowLayout.of(context).twoPane,
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
