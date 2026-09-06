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
import 'package:go_router/go_router.dart';

import '../http/api_client.dart';

/// The server's locale-agnostic code for a gated feature (lowercase — it comes
/// from `lib/core/errors/app-error.ts`, not from the SCREAMING_CASE OCR codes
/// it sits beside in the error maps).
const String kFeatureLockedCode = 'feature_locked';

/// Send the user to the paywall. The one place the route literal lives for
/// feature-lock recovery, so a controller that already mapped its 402 onto an
/// error key (the scan sheets) lands in the same place as a raw catch site.
void openPaywall(BuildContext context) => context.push('/paywall');

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
