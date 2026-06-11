import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../../theme/nham_theme.dart';

/// "Continue with Apple" — the official Apple-styled button.
///
/// Apple's Human Interface Guidelines require the system-provided button (or a
/// close, compliant equivalent) for Sign in with Apple, so we use
/// [SignInWithAppleButton] rather than a hand-rolled one. The black style sits
/// well on the cream surface; placed above Google it is the most prominent
/// social option, satisfying App Store Guideline 4.8. The brand radius keeps it
/// visually consistent with the Google button beneath it.
class AppleButton extends StatelessWidget {
  const AppleButton({super.key, required this.onPressed, required this.busy});

  final VoidCallback onPressed;

  /// Any auth request is in flight — dims + blocks the button.
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: busy ? 0.6 : 1.0,
      child: IgnorePointer(
        ignoring: busy,
        child: SignInWithAppleButton(
          onPressed: onPressed,
          text: tr('auth.dialog.continueWithApple'),
          height: 48,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
        ),
      ),
    );
  }
}
