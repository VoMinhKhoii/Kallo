import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_step_spec.dart';
import 'narrative/centred_when_short.dart';
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
    this.besideQuestion = false,
  });

  final OnboardingStepSpec spec;

  /// The question stands in the pane beside this one. The title is over
  /// there, and a short answer centres on the question's height instead of
  /// hanging from the top with the rest of the pane empty under it.
  final bool besideQuestion;

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
          if (!besideQuestion) ...[
            Text(spec.title, style: kPageTitle()),
            const SizedBox(height: KalloSpacing.sp3),
          ],
          Expanded(
            child: LayoutBuilder(
              builder:
                  (context, box) => SingleChildScrollView(
                    primary: false,
                    padding: EdgeInsets.only(bottom: bottomInset),
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    // The same wrapper in every window, with nothing to
                    // centre in when the title is above: a fold must not
                    // change the tree over the body, or its fields would
                    // start again empty.
                    child: CentredWhenShort(
                      height: besideQuestion ? box.maxHeight - bottomInset : 0,
                      child: spec.body,
                    ),
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
