import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/logic/legal_links.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../auth_controls.dart' show kAuthFootnote;

/// "Terms · Privacy" — the welcome screen's footer (native pass, 2026-08-31).
///
/// The consent sentence above it says what continuing agrees to; these two
/// links are how you go and read it, which the sentence alone never offered.
/// 13pt underlined-in-hairline, each in a 44pt target, opening the same
/// in-app browser Settings and the paywall use.
class AuthLegalLinks extends StatelessWidget {
  const AuthLegalLinks({super.key});

  @override
  Widget build(BuildContext context) {
    final languageCode = context.locale.languageCode;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _LegalLink(
          label: tr('paywall.terms'),
          onTap: () => openLegalPage(context, termsUrlFor(languageCode)),
        ),
        Text('·', style: dashMeta().copyWith(fontSize: kAuthFootnote)),
        _LegalLink(
          label: tr('paywall.privacy'),
          onTap: () => openLegalPage(context, privacyUrlFor(languageCode)),
        ),
      ],
    );
  }
}

class _LegalLink extends StatelessWidget {
  const _LegalLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      link: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: KalloIcons.hit),
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp2),
          alignment: Alignment.center,
          child: Text(
            label,
            style: dashMeta().copyWith(
              fontSize: kAuthFootnote,
              // Underlined in the hairline, not in the text colour: the rule
              // marks the words as a link without darkening a line the eye is
              // meant to skip past.
              decoration: TextDecoration.underline,
              decorationColor: KalloColors.border,
            ),
          ),
        ),
      ),
    );
  }
}
