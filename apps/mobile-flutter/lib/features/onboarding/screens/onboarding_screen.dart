import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../services/auth/session_provider.dart';
import '../../../theme/kallo_colors.dart';
import '../providers/onboarding_providers.dart';
import '../widgets/onboarding_wizard.dart';

/// The onboarding wizard as a true full page.
///
/// Mounted at `/onboarding`, which both auth states reach (see `router.dart`):
///
///   • **Signed out** — the normal first run. Every answer goes to the local
///     draft, finishing hands over to `/save-plan` (where signing in is what
///     saves the plan), and backing out of screen 1 returns to `/start`. There
///     is nothing to dismiss into, so the session-scoped dismissed flag stays
///     untouched.
///   • **Signed in** — the forced first-run pass for brand-new accounts.
///     The canvas fills the screen edge-to-edge with no scrim or floating
///     card; that modal chrome is reserved for the sidebar resume path
///     ([showOnboardingDialog]). Per the user decision the page is skippable:
///     closing marks the session-scoped dismissed flag so the router doesn't
///     immediately re-force, and drops to the app. Finishing routes to the
///     `/welcome` setup interstitial.
class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(currentSessionProvider) != null;
    return Scaffold(
      backgroundColor: KalloColors.surface,
      body: SafeArea(
        child: OnboardingWizard(
          onComplete: () => context.go(signedIn ? '/welcome' : '/save-plan'),
          onClose: () {
            if (!signedIn) {
              context.go('/start');
              return;
            }
            ref.read(onboardingForceDismissedProvider.notifier).state = true;
            context.go('/dashboard');
          },
        ),
      ),
    );
  }
}
