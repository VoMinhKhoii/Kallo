/// The client's response to a server feature gate.
///
/// The server is the ONLY enforcer: a gated `/api/v1` endpoint answers HTTP
/// 402 with `{error:{code:'feature_locked', ...}}`. The entitlement feature map
/// exists purely so the UI can show a lock BEFORE the round trip — it never
/// decides whether a mutation may run. This is the other half of that contract:
/// when a mutation comes back 402, send the user to the paywall instead of
/// toasting a generic failure.
///
/// Deliberately NOT wired into [ApiClient]: it has no BuildContext, and a
/// blanket redirect there would hijack background refreshes and prefetches that
/// the user never asked for.
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/http/api_error.dart';
import '../http/api_client.dart';
import 'entitlement_state.dart';
import 'entitlements_provider.dart';

/// The server's locale-agnostic code for a gated feature (lowercase — it comes
/// from `lib/core/errors/app-error.ts`, not from the SCREAMING_CASE OCR codes
/// it sits beside in the error maps).
const String kFeatureLockedCode = 'feature_locked';

/// Send the user to the paywall. The one place the route literal lives for
/// feature-lock recovery, so a controller that already mapped its 402 onto an
/// error key (the scan sheets) lands in the same place as a raw catch site.
void openPaywall(BuildContext context) => context.push('/paywall');

/// Whether a Premium marker (`PremiumChip` / `PremiumDot`) should show for
/// [feature] — [EntitlementState.showsLockFor] on the signed-in user's
/// snapshot. False until the snapshot loads: a marker that flashed on for a
/// premium user while the fetch was in flight would be a false claim, while a
/// late marker for a free user costs nothing (the server's 402 still routes a
/// tap to the paywall).
///
/// UX only, like the feature map it reads — it may hide a marker, never permit
/// an action.
final premiumLockProvider = Provider.autoDispose.family<bool, String>((
  ref,
  feature,
) {
  final userId = ref.watch(entitlementsUserIdProvider);
  final snapshot = ref.watch(entitlementsProvider(userId)).valueOrNull;
  return snapshot?.showsLockFor(feature) ?? false;
});

/// One Premium feature's lock, read once at the top of a `build`: whether its
/// marker shows, and what a tap on its affordance does.
@immutable
class PremiumGate {
  const PremiumGate({required this.locked});

  /// [premiumLockProvider] for the feature — show the Premium marker.
  final bool locked;

  /// The tap handler for the gated affordance: the paywall while [locked],
  /// else [action]. Locked WINS over a null [action] — a busy flag that would
  /// disable the button must not also swallow the route to the paywall.
  VoidCallback? tap(BuildContext context, VoidCallback? action) =>
      locked ? () => openPaywall(context) : action;
}

/// Watches [premiumLockProvider] for [feature] (a [PremiumFeature] name).
/// Call it at the top of `build`, never inside a callback or after an early
/// return.
PremiumGate premiumGate(WidgetRef ref, String feature) =>
    PremiumGate(locked: ref.watch(premiumLockProvider(feature)));

/// Whether [error] is the server refusing a gated feature.
bool isFeatureLocked(Object error) => error is ApiError && error.status == 402;

/// Route a feature-lock failure to the paywall.
///
/// Returns true when [error] was a 402 and this call owned the response, so the
/// caller can skip its own error toast:
///
/// ```dart
/// } catch (error) {
///   if (!handledFeatureLock(context, error)) showTopToast(context, ...);
/// }
/// ```
bool handledFeatureLock(BuildContext context, Object error) {
  if (!isFeatureLocked(error)) return false;
  // Still "handled": the caller must not fall through to a generic error toast
  // just because the surface went away mid-flight.
  if (context.mounted) openPaywall(context);
  return true;
}
