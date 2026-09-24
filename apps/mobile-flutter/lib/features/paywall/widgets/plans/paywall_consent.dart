import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/logic/legal_links.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../data/paywall_controller.dart';
import '../../logic/paywall_result.dart';

/// The fine print under the buy band, with Restore, Terms and Privacy Policy
/// as underlined links INSIDE the sentence — the separate
/// "Restore · Terms · Privacy" row it replaces said the same three things a
/// second time, one line lower.
///
/// The sentence is one translated string with `{restore}`, `{terms}` and
/// `{privacy}` slots, so each language puts the links where its grammar wants
/// them; the slots are split out here and filled with tappable spans.
///
/// Inline links cannot carry the 44pt target the old row's `MetaAction`s had —
/// that is the trade the approved design makes for one line of legal copy
/// instead of two, the same way iOS system sheets set their legal links.
class PaywallConsent extends ConsumerStatefulWidget {
  const PaywallConsent({super.key});

  @override
  ConsumerState<PaywallConsent> createState() => _PaywallConsentState();
}

/// The three link slots the consent sentence carries, by their `{name}`.
enum _Slot { restore, terms, privacy }

class _PaywallConsentState extends ConsumerState<PaywallConsent> {
  static final RegExp _slot = RegExp(r'\{(restore|terms|privacy)\}');

  late final TapGestureRecognizer _restore =
      TapGestureRecognizer()..onTap = _onRestore;
  late final TapGestureRecognizer _terms =
      TapGestureRecognizer()
        ..onTap =
            () => openLegalPage(
              context,
              termsUrlFor(context.locale.languageCode),
            );
  late final TapGestureRecognizer _privacy =
      TapGestureRecognizer()
        ..onTap =
            () => openLegalPage(
              context,
              privacyUrlFor(context.locale.languageCode),
            );

  @override
  void dispose() {
    _restore.dispose();
    _terms.dispose();
    _privacy.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Watched here rather than passed down: nothing else on the band cares
    // about the purchase phase.
    final phase = ref.watch(
      paywallControllerProvider.select((state) => state.phase),
    );
    final busy =
        phase == PaywallPhase.purchasing || phase == PaywallPhase.verifying;
    // 11, one step under the caption tier: this is the fine print, and at 12
    // the Vietnamese sentence takes a third line off the table above it.
    final base = dashCaption().copyWith(fontSize: 11, height: 1.35);
    final link = base.copyWith(
      color: kInk,
      decoration: TextDecoration.underline,
      decorationColor: kInk,
    );
    return Text.rich(
      TextSpan(style: base, children: _spans(link, busy: busy)),
      textAlign: TextAlign.center,
    );
  }

  List<InlineSpan> _spans(TextStyle link, {required bool busy}) {
    final sentence = tr('paywall.consent');
    final spans = <InlineSpan>[];
    var start = 0;
    for (final match in _slot.allMatches(sentence)) {
      spans.add(TextSpan(text: sentence.substring(start, match.start)));
      spans.add(_link(_Slot.values.byName(match.group(1)!), link, busy: busy));
      start = match.end;
    }
    spans.add(TextSpan(text: sentence.substring(start)));
    return spans;
  }

  TextSpan _link(_Slot slot, TextStyle style, {required bool busy}) =>
      switch (slot) {
        // Recedes rather than disappearing while the store round trip is in
        // flight, so the sentence does not reflow.
        _Slot.restore => TextSpan(
          text: tr('paywall.consentRestore'),
          style: busy ? style.copyWith(color: KalloColors.textMuted50) : style,
          recognizer: busy ? null : _restore,
        ),
        _Slot.terms => TextSpan(
          text: tr('paywall.consentTerms'),
          style: style,
          recognizer: _terms,
        ),
        _Slot.privacy => TextSpan(
          text: tr('paywall.consentPrivacy'),
          style: style,
          recognizer: _privacy,
        ),
      };

  Future<void> _onRestore() async {
    HapticFeedback.lightImpact();
    final result = await ref.read(paywallControllerProvider.notifier).restore();
    if (mounted) handlePaywallResult(context, result);
  }
}
