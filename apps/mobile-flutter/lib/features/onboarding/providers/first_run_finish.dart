/// Everything the `/welcome` interstitial has to DO, with none of what it has
/// to draw.
///
/// The screen used to run this from inside its `State`: the draft flush, three
/// cache invalidations, the dashboard warm-up and its timeout, the entitlement
/// read with its `listenManual` keep-alive, the session-scoped dismissed flag,
/// the pending-invite branch and the paywall branch — which meant a widget file
/// importing four other features to answer one question. It is a controller
/// question, so it lives here, in the same `Ref`-held shape as
/// [SaveScreenController]; the screen keeps the count-up and the minimum
/// window, which are the two things that are genuinely about what is on screen.
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

    // They've been through the wizard — stop the router force-routing this
    // session (covers the skip-all-to-finish case, where the profile is still
    // "incomplete" but they shouldn't be bounced back into onboarding).
    _ref.read(onboardingForceDismissedProvider.notifier).state = true;

    return (target: resolved, next: _next(showPaywall));
  }

  /// A pending circle invite (the link that brought this brand-new user here)
  /// outranks the default landing — finish the connect they came for. Otherwise
  /// the last beat of the first run is Kallo Pro, whose two exits both continue
  /// into the logging feed; a user who already has it goes straight there.
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
          .read(dashboardBundleProvider((userId: userId, date: todayDateString()))
              .future)
          .timeout(kFirstRunReadTimeout);
      return bundle.profile?.calorieTarget.round();
    } catch (_) {
      return null;
    }
  }

  /// Whether to end the first run on Kallo Pro.
  ///
  /// Only for someone who could actually buy it: a user who restored premium on
  /// this device (or bought it on another) has nothing to be sold. An
  /// UNREADABLE snapshot answers the same way — failing to reach the endpoint
  /// is not evidence that a paying customer is on free, and the paywall is one
  /// tap away from Settings either way.
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
