import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../auth_controls.dart';
import 'apple_button.dart';
import 'auth_legal_links.dart';
import 'google_button.dart';

/// The three ways in — Apple, Google, email — with the consent sentence and
/// its two links under them.
///
/// The stack, not the screen: `/sign-in` shows it under the brand block
/// ([WelcomeView]), `/save-plan` under the onboarding chrome, both with the
/// same options in the same order and ONE legal footnote. Every button is a
/// 50pt full-round pill ([kAuthButtonHeight]) — ink for Apple, quiet
/// white-and-hairline for the other two.
class AuthOptions extends StatelessWidget {
  const AuthOptions({
    super.key,
    required this.busy,
    required this.googleBusy,
    required this.onApple,
    required this.onGoogle,
    required this.onEmail,
  });

  /// Any auth request is in flight — dims and blocks every option.
  final bool busy;

  /// Google is the in-flight one — swaps its logo for a spinner.
  final bool googleBusy;

  final VoidCallback onApple;
  final VoidCallback onGoogle;
  final VoidCallback onEmail;

  @override
  Widget build(BuildContext context) {
    final showApple =
        defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showApple) ...[
          AppleButton(busy: busy, onPressed: onApple),
          const SizedBox(height: KalloSpacing.sp3),
        ],
        GoogleButton(busy: busy, loading: googleBusy, onPressed: onGoogle),
        const SizedBox(height: KalloSpacing.sp3),
        _EmailEntryButton(busy: busy, onPressed: onEmail),
        const SizedBox(height: KalloSpacing.sp6),
        Text(
          tr('auth.welcome.terms'),
          textAlign: TextAlign.center,
          style: dashMeta().copyWith(fontSize: kAuthFootnote),
        ),
        const AuthLegalLinks(),
      ],
    );
  }
}

/// "Continue with email" — the quiet tier, matching the Google button's shape
/// and its 50pt full-round pill so the three options read as one stack. The
/// envelope gives it the leading mark its neighbours have; without one its
/// label sat centred against two that were not.
class _EmailEntryButton extends StatefulWidget {
  const _EmailEntryButton({required this.onPressed, required this.busy});

  final VoidCallback onPressed;
  final bool busy;

  @override
  State<_EmailEntryButton> createState() => _EmailEntryButtonState();
}

class _EmailEntryButtonState extends State<_EmailEntryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final fill = _pressed ? KalloColors.hover : KalloColors.elev;
    return Opacity(
      opacity: widget.busy ? 0.6 : 1.0,
      child: Semantics(
        button: true,
        enabled: !widget.busy,
        label: tr('auth.welcome.continueWithEmail'),
        excludeSemantics: true,
        child: GestureDetector(
          onTapDown: widget.busy ? null : (_) => setState(() => _pressed = true),
          onTapUp: widget.busy ? null : (_) => setState(() => _pressed = false),
          onTapCancel: widget.busy
              ? null
              : () => setState(() => _pressed = false),
          onTap: widget.busy ? null : widget.onPressed,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            constraints: const BoxConstraints(minHeight: kAuthButtonHeight),
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
            decoration: BoxDecoration(
              color: fill,
              borderRadius: BorderRadius.circular(KalloRadii.button),
              border: Border.all(color: KalloColors.border),
            ),
            alignment: Alignment.center,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  LucideIcons.mail300,
                  size: 18,
                  color: KalloColors.text,
                ),
                const SizedBox(width: KalloSpacing.sp2),
                Text(
                  tr('auth.welcome.continueWithEmail'),
                  style: dashBody(
                    weight: FontWeight.w600,
                  ).copyWith(color: KalloColors.text, letterSpacing: -0.2),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
