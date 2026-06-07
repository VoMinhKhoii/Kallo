import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../theme/nham_colors.dart';
import '../providers/onboarding_providers.dart';
import '../widgets/onboarding_wizard.dart';

/// The forced first-run onboarding: the wizard as a true full page.
///
/// Mounted at `/onboarding` (the router only routes brand-new first-session
/// users here — see `router.dart`). Cream fills the screen edge-to-edge with no
/// scrim or floating card; that modal chrome is reserved for the sidebar resume
/// path ([showOnboardingDialog]). Per the user decision the page is skippable:
/// closing marks the session-scoped dismissed flag so the router doesn't
/// immediately re-force, and drops to the app. Finishing routes to the
/// `/welcome` setup interstitial.
class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: NhamColors.cream,
      body: SafeArea(
        child: OnboardingWizard(
          onComplete: () => context.go('/welcome'),
          onClose: () {
            ref.read(onboardingForceDismissedProvider.notifier).state = true;
            context.go('/dashboard');
          },
        ),
      ),
    );
  }
}
