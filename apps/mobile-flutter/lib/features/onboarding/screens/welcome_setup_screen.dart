import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/session_provider.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../../circle/data/circle_providers.dart';
import '../../dashboard/data/dashboard_providers.dart';
import '../../dashboard/logic/dashboard_format.dart';
import '../../logging/data/logging_providers.dart';
import '../providers/onboarding_providers.dart';

/// The celebratory finish shown after the wizard completes, before landing on
/// `/logging`.
///
/// It does double duty: a deliberate beat that pays off the wizard by counting
/// the freshly-computed daily calorie target up in Lora 40, and a cache-warm
/// gate that drops the stale/null targets the dashboard + logging screens may
/// be holding (the per-step saves only refreshed the profile). It invalidates
/// the profile, dashboard bundle, and logging profile, warms the dashboard
/// fetch (the authority on the computed target), holds a minimum window so it
/// never flashes, then routes on.
class WelcomeSetupScreen extends ConsumerStatefulWidget {
  const WelcomeSetupScreen({super.key});

  @override
  ConsumerState<WelcomeSetupScreen> createState() => _WelcomeSetupScreenState();
}

class _WelcomeSetupScreenState extends ConsumerState<WelcomeSetupScreen>
    with SingleTickerProviderStateMixin {
  // Drives the count-up from 0 → target.
  late final AnimationController _count = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  int? _target;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  @override
  void dispose() {
    _count.dispose();
    super.dispose();
  }

  Future<void> _run() async {
    // Drop any stale instances so the dashboard/logging targets refetch fresh.
    ref.invalidate(dashboardBundleProvider);
    ref.invalidate(loggingProfileProvider);
    ref.invalidate(profileProvider);

    final userId = ref.read(currentSessionProvider)?.user.id;

    // Warm the dashboard bundle (the computed target lives here), but never
    // block the finish on a slow/failed fetch — the min window carries the UX.
    Future<void> warm = Future<void>.value();
    if (userId != null) {
      final args = (userId: userId, date: todayDateString());
      warm = ref
          .read(dashboardBundleProvider(args).future)
          .then<void>((bundle) {
            final t = bundle.profile?.calorieTarget;
            if (t != null && mounted) {
              setState(() => _target = t.round());
              final reduced = WidgetsBinding
                  .instance
                  .platformDispatcher
                  .accessibilityFeatures
                  .disableAnimations;
              if (reduced) {
                _count.value = 1;
              } else {
                _count.forward();
              }
            }
          }, onError: (_, __) {})
          .timeout(const Duration(seconds: 6), onTimeout: () {});
    }

    await Future.wait([
      warm,
      Future<void>.delayed(const Duration(milliseconds: 1600)),
    ]);

    if (!mounted) return;
    // They've been through the wizard — stop the router force-routing this
    // session (covers the skip-all-to-finish case, where the profile is still
    // "incomplete" but they shouldn't be bounced back into onboarding).
    ref.read(onboardingForceDismissedProvider.notifier).state = true;
    // A pending circle invite (the link that brought this brand-new user here)
    // outranks the default landing — finish the connect they came for.
    final pendingInvite = ref.read(pendingInviteSlugProvider);
    if (pendingInvite != null) {
      context.go('/circle/invite/$pendingInvite');
      return;
    }
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
                if (_target != null) ...[
                  Text(
                    tr('onboarding.setup.targetReadyLabel').toUpperCase(),
                    textAlign: TextAlign.center,
                    style: dashEyebrow(),
                  ),
                  const SizedBox(height: 10),
                  // The target counts up in Lora 40.
                  AnimatedBuilder(
                    animation: _count,
                    builder: (context, _) {
                      final shown = (_target! * _count.value).round();
                      return Text.rich(
                        TextSpan(
                          children: [
                            // Locale-aware grouping (en "2,000" / vi "2.000").
                            TextSpan(
                              text: formatCount(
                                shown,
                                context.locale.toString(),
                              ),
                            ),
                            TextSpan(
                              text: ' ${tr('onboarding.setup.perDay')}',
                              style: dashMeta(),
                            ),
                          ],
                        ),
                        textAlign: TextAlign.center,
                        style: NhamTextStyles.serifRegular(
                          fontSize: NhamFontSize.h1,
                        ).copyWith(color: NhamColors.text),
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                ],
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
                  style: dashBody(color: kInkMuted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
