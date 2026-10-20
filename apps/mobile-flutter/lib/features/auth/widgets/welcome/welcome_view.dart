import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import 'auth_brand_hero.dart';

/// The pre-auth welcome face: the wordmark and its one line in the space the
/// [options] stack leaves, with the stack anchored to the bottom — where
/// `/start` keeps its own buttons, so the thumb finds them in the same place.
///
/// No demo. A new install reaches this from `/start`, whose device preview has
/// just shown the app; the typing demo that sat here pitched it a second time,
/// with a Vietnamese meal and a total no analysis had produced. The other ways
/// in (signing out, a deleted account, an invite link) are people who know the
/// app or were sent by someone who does.
///
/// The options come in from outside rather than being built here: `/save-plan`
/// shows the same stack under the onboarding chrome, with no brand block above
/// it (it would be the second wordmark on that screen, re-pitching the app to
/// someone three screens into it).
///
/// Needs a bounded height to anchor against; [AuthPage] gives it the safe area.
class WelcomeView extends StatelessWidget {
  const WelcomeView({super.key, required this.options});

  /// The three sign-in options and their legal footnote — [AuthOptions].
  final Widget options;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('welcome'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const AuthBrandHero(),
              const SizedBox(height: KalloSpacing.sp2),
              // One quiet muted line: the wordmark is the headline here.
              Text(
                tr('auth.welcome.tagline'),
                textAlign: TextAlign.center,
                style: dashBody(color: kInkMuted),
              ),
            ],
          ),
        ),
        // The least the brand block keeps from the buttons on a short phone,
        // where the space above has nothing to spare.
        const SizedBox(height: KalloSpacing.sp8),
        options,
      ],
    );
  }
}
