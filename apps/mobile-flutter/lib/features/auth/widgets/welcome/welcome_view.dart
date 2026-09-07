import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import 'auth_brand_hero.dart';
import 'welcome_demo.dart';

/// The pre-auth welcome face: the brand block — wordmark, tagline, typing demo
/// — over the [options] stack it was handed.
///
/// Restyled to the canvas (native pass, 2026-08-31): the brand block sits high
/// with the buttons anchored low, and the tagline drops to one quiet 14 muted
/// line so the wordmark keeps the screen's only serif voice.
///
/// The options come in from outside rather than being built here: `/save-plan`
/// shows the same stack under the onboarding chrome, with no brand block above
/// it (it would be the second wordmark on that screen, re-pitching the app to
/// someone three screens into it).
class WelcomeView extends StatelessWidget {
  const WelcomeView({super.key, required this.options});

  /// The three sign-in options and their legal footnote — [AuthOptions].
  final Widget options;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('welcome'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: KalloSpacing.sp16),
        const AuthBrandHero(),
        const SizedBox(height: KalloSpacing.sp2),
        // One quiet 14 muted line. It was a serif sentence with a tan italic
        // clause, which put a second editorial voice directly under the serif
        // wordmark — two serif moments in one viewport, and the type system
        // allows exactly one.
        Text(
          '${tr('auth.welcome.tagline')} ${tr('auth.welcome.taglineHighlight')}',
          textAlign: TextAlign.center,
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: KalloSpacing.sp8),
        const WelcomeDemo(),
        const SizedBox(height: KalloSpacing.sp8),
        options,
      ],
    );
  }
}
