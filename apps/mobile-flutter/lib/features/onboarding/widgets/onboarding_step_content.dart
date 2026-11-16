import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_step_spec.dart';
import 'onboarding_step_swipe.dart';

/// The sliding region of a wizard screen: the title, then the screen's own
/// controls under it in a scroll view that starts at the top on every screen.
///
/// Its own file so the swipe recogniser has somewhere to live that is not
/// [OnboardingStepScaffold], which sits at the 200-line widget budget — and
/// because "the part that moves" is a real seam: everything the scaffold keeps
/// is the chrome that deliberately does NOT move between screens.
class OnboardingStepContent extends StatelessWidget {
  const OnboardingStepContent({
    super.key,
    required this.spec,
    required this.bottomInset,
    required this.onBack,
  });

  final OnboardingStepSpec spec;

  /// Room under the scroll body for the CTA that overlays it, plus the home
  /// indicator.
  final double bottomInset;

  /// One screen back — null where there is nowhere to go, or while a save is
  /// in flight.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return OnboardingStepSwipe(
      onBack: onBack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(spec.title, style: kPageTitle()),
          const SizedBox(height: KalloSpacing.sp3),
          Expanded(
            child: SingleChildScrollView(
              primary: false,
              padding: EdgeInsets.only(bottom: bottomInset),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: spec.body,
            ),
          ),
        ],
      ),
    );
  }
}
