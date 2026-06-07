import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../../dashboard/data/dashboard_providers.dart';
import '../../logging/data/logging_providers.dart';
import '../providers/onboarding_providers.dart';

/// "Setting up your account" — the celebratory finish shown after the wizard
/// completes, before landing on `/logging`.
///
/// It does double duty: a lively beat so the transition feels deliberate, and a
/// cache-warm gate that drops the stale/null targets the dashboard + logging
/// screens may be holding (the per-step saves only refreshed the profile). It
/// invalidates the profile, dashboard bundle, and logging profile, warms the
/// profile fetch, holds a minimum window so it never flashes, then routes on.
class WelcomeSetupScreen extends ConsumerStatefulWidget {
  const WelcomeSetupScreen({super.key});

  @override
  ConsumerState<WelcomeSetupScreen> createState() => _WelcomeSetupScreenState();
}

class _WelcomeSetupScreenState extends ConsumerState<WelcomeSetupScreen>
    with SingleTickerProviderStateMixin {
  // Gentle radar pulse around the badge.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _run() async {
    // Drop any stale instances so the dashboard/logging targets refetch fresh.
    ref.invalidate(dashboardBundleProvider);
    ref.invalidate(loggingProfileProvider);
    ref.invalidate(profileProvider);

    // Warm the profile (targets), but never block the finish on a slow/failed
    // fetch — the min window carries the UX either way.
    final warm = ref
        .read(profileProvider.future)
        .then<void>((_) {}, onError: (_, __) {})
        .timeout(const Duration(seconds: 6), onTimeout: () {});

    await Future.wait([
      warm,
      Future<void>.delayed(const Duration(milliseconds: 1600)),
    ]);

    if (!mounted) return;
    // They've been through the wizard — stop the router force-routing this
    // session (covers the skip-all-to-finish case, where the profile is still
    // "incomplete" but they shouldn't be bounced back into onboarding).
    ref.read(onboardingForceDismissedProvider.notifier).state = true;
    context.go('/logging');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NhamColors.cream,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _Badge(pulse: _pulse),
                const SizedBox(height: 28),
                Text(
                  tr('onboarding.setup.title'),
                  textAlign: TextAlign.center,
                  style: NhamTextStyles.serifRegular(fontSize: NhamFontSize.h3)
                      .copyWith(color: NhamColors.text),
                ),
                const SizedBox(height: 8),
                Text(
                  tr('onboarding.setup.subtitle'),
                  textAlign: TextAlign.center,
                  style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.md)
                      .copyWith(color: NhamColors.textMuted, height: 1.4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Accent badge with a check, wrapped by an expanding-and-fading radar ring.
class _Badge extends StatelessWidget {
  const _Badge({required this.pulse});

  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 120,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: pulse,
            builder: (context, _) {
              final v = pulse.value;
              final size = 76 + 44 * v;
              return Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: NhamColors.accent.withValues(alpha: (1 - v) * 0.22),
                ),
              );
            },
          ),
          Container(
            width: 76,
            height: 76,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: NhamColors.accent,
            ),
            child: const Icon(
              Icons.check_rounded,
              size: 38,
              color: NhamColors.cream,
            ),
          ),
        ],
      ),
    );
  }
}
