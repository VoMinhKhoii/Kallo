/// Everything the `/welcome` interstitial has to DO, with none of what it has
/// to draw: the draft flush, the cache invalidations, the two network reads and
/// the routing decision. Held in the same `Ref`-shape as [SaveScreenController]
/// so the screen keeps only the count-up and the minimum window.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../../services/billing/entitlements_provider.dart';
import '../../../shared/logic/display_format.dart';
import '../../circle/data/circle_providers.dart';
import '../../dashboard/data/dashboard_providers.dart';
import '../../logging/data/logging_providers.dart';
import 'onboarding_draft_providers.dart';
import 'onboarding_providers.dart';

/// How long the finish waits on either network read before giving up on it.
/// Neither is allowed to hold the first run open: the minimum window carries
/// the UX and both have a safe answer when they time out.
const Duration kFirstRunReadTimeout = Duration(seconds: 6);

class FirstRunFinishController {
  const FirstRunFinishController(this._ref);

  final Ref _ref;

  /// Flush, warm, decide.
  ///
  /// Returns the freshly-computed daily calorie target for the count-up (`null`
  /// when there is none to show) and the route the first run ends on.
  ///
  /// THROWS only when the flush failed — the draft is then still on disk (see
  /// [OnboardingDraftNotifier.flush]) and the caller must stop and offer a
  /// retry, because walking on would drop the user into an app that has none of
  /// their answers. Everything after the flush is best-effort.
  Future<({int? target, String next})> finish() async {
    // The signed-out wizard posted nothing — this is where the answers reach
    // the server. A signed-in run has no draft and this returns immediately.
    await _ref.read(onboardingDraftProvider.notifier).flush();

    // Drop any stale instances so the dashboard/logging targets refetch fresh
    // (the per-screen saves only refreshed the profile).
    _ref.invalidate(dashboardBundleProvider);
    _ref.invalidate(loggingProfileProvider);
    _ref.invalidate(profileProvider);

    final userId = _ref.read(currentSessionProvider)?.user.id;
    // Both reads start before either is awaited: they are independent, and the
    // finish is only as slow as the slower one.
    final target = _warmTarget(userId);
    final offerPro = _shouldOfferPro(userId);

    final resolved = await target;
    final showPaywall = await offerPro;

    // Stop the router force-routing this session — covers skip-all-to-finish,
    // where the profile is "incomplete" but there is nothing left to ask.
    _ref.read(onboardingForceDismissedProvider.notifier).state = true;

    return (target: resolved, next: _next(showPaywall));
  }

  /// A pending circle invite outranks the default landing — finish the connect
  /// they came for. Otherwise the first run ends on Kallo Pro, whose two exits
  /// both continue into the logging feed.
  String _next(bool showPaywall) {
    final pendingInvite = _ref.read(pendingInviteSlugProvider);
    if (pendingInvite != null) return '/circle/invite/$pendingInvite';
    return showPaywall ? '/paywall?onboarding=1' : '/logging';
  }

  /// Warm the dashboard bundle — the authority on the computed target — and
  /// report the number it lands on. Never blocks the finish on a slow or failed
  /// fetch: no target simply means no count-up.
  Future<int?> _warmTarget(String? userId) async {
    if (userId == null) return null;
    try {
      final bundle = await _ref
          .read(
            dashboardBundleProvider((
              userId: userId,
              date: todayDateString(),
            )).future,
          )
          .timeout(kFirstRunReadTimeout);
      return bundle.profile?.calorieTarget.round();
    } catch (_) {
      return null;
    }
  }

  /// Whether to end the first run on Kallo Pro — only for someone who could
  /// actually buy it. An UNREADABLE snapshot answers `false` too: failing to
  /// reach the endpoint is not evidence that a paying customer is on free, and
  /// the paywall is one tap away from Settings either way.
  Future<bool> _shouldOfferPro(String? userId) async {
    if (userId == null) return false;
    // Holds the auto-dispose family member open for the length of the read: a
    // bare `ref.read(...future)` can be disposed before it resolves.
    final keepAlive = _ref.listen(entitlementsProvider(userId), (_, _) {});
    try {
      final entitlement = await _ref
          .read(entitlementsProvider(userId).future)
          .timeout(kFirstRunReadTimeout);
      return !entitlement.isPremium;
    } catch (_) {
      return false;
    } finally {
      keepAlive.close();
    }
  }
}

/// Imperative handle for the widget layer, which holds a `WidgetRef` rather
/// than the `Ref` the controller needs. Same shape as
/// [saveScreenControllerProvider].
final firstRunFinishProvider = Provider<FirstRunFinishController>(
  (ref) => FirstRunFinishController(ref),
);
