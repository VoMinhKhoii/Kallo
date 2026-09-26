/// The gate every AI entry point passes through before anything is sent:
/// meal analysis (precise, cheat, relog-with-text, clarify — all through
/// `FeedAnalysisRun`) and label scanning (`LabelScanBranch`). Web counterpart:
/// `AiConsentGate` (`lib/domain/privacy/consent-gate.ts`).
library;

import 'dart:async' show unawaited;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../onboarding/providers/onboarding_providers.dart';
import '../data/ai_consent_providers.dart';
import '../widgets/ai_consent_sheet.dart';

/// Resolves true when consent is on record — showing the one-time sheet first
/// when it is not. False means the user chose "Not now": send nothing.
///
/// A profile still loading is awaited rather than read as "no consent", so a
/// user who already agreed is never asked again just because the row had not
/// arrived yet.
Future<bool> ensureAiConsent(BuildContext context, WidgetRef ref) async {
  if (ref.read(aiConsentProvider)) return true;
  if (ref.read(aiConsentRecordProvider) == null &&
      !ref.read(profileProvider).hasValue) {
    try {
      await ref.read(profileProvider.future);
    } catch (_) {
      // Unknown reads as not consented: the sheet asks, the server decides.
    }
  }
  if (ref.read(aiConsentProvider)) return true;
  if (!context.mounted) return false;
  return showAiConsentSheet(context);
}

/// Run [start] — something that sends user content to the AI — only once
/// consent is on record, asking first when it is not. Fire-and-forget for the
/// synchronous submit handlers; [start] is skipped if the asking surface went
/// away while the sheet was up.
///
/// Synchronous when consent is already on record, so a consented user's submit
/// runs in the same frame it always did.
void startWithAiConsent(
  BuildContext context,
  WidgetRef ref,
  VoidCallback start,
) {
  if (ref.read(aiConsentProvider)) return start();
  unawaited(
    ensureAiConsent(context, ref).then((ok) {
      if (ok && context.mounted) start();
    }),
  );
}

/// [startWithAiConsent] with at most ONE ask in flight, for a surface that can
/// be tapped again while the sheet is still coming up. A call landing while an
/// ask is pending is dropped: a fast double tap must never stack two sheets or
/// start two analyses.
class AiConsentAsk {
  bool _pending = false;

  /// Run [start] once consent is on record, asking first. [onDeclined] runs
  /// instead on "Not now", or when this call was dropped behind a pending ask:
  /// either way nothing is sent, and the caller keeps what it would have sent.
  void run(
    BuildContext context,
    WidgetRef ref,
    VoidCallback start, {
    VoidCallback? onDeclined,
  }) {
    if (ref.read(aiConsentProvider)) return start();
    if (_pending) return onDeclined?.call();
    _pending = true;
    unawaited(_ask(context, ref, start, onDeclined));
  }

  Future<void> _ask(
    BuildContext context,
    WidgetRef ref,
    VoidCallback start,
    VoidCallback? onDeclined,
  ) async {
    final bool ok;
    try {
      ok = await ensureAiConsent(context, ref);
    } finally {
      _pending = false;
    }
    if (!context.mounted) return;
    ok ? start() : onDeclined?.call();
  }
}

/// The server refused with `ai_consent_required` (consent withdrawn on another
/// device, or a stale profile): forget what this device believed and ask.
Future<bool> reaskAiConsent(BuildContext context, WidgetRef ref) {
  ref.read(aiConsentRecordProvider.notifier).markMissing();
  return showAiConsentSheet(context);
}
