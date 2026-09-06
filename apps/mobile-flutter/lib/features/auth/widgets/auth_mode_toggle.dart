import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import 'auth_controls.dart';

/// The quiet line under the email form that flips it in place between signing
/// in and creating an account — "Don't have an account? Sign up", and its
/// mirror. Presentational only: the mode, the busy state and what a tap does
/// all belong to the form that owns them.
class AuthModeToggle extends StatelessWidget {
  const AuthModeToggle({
    super.key,
    required this.createMode,
    required this.busy,
    required this.onToggle,
  });

  /// Whether the form is currently in account-creation mode.
  final bool createMode;

  /// A request is in flight: the toggle dims and stops taking taps, so the
  /// mode cannot change out from under a submit.
  final bool busy;

  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          createMode
              ? tr('auth.signUp.hasAccount')
              : tr('auth.signIn.noAccount'),
          style: dashMeta().copyWith(fontSize: kAuthFootnote),
        ),
        Opacity(
          opacity: busy ? 0.6 : 1.0,
          child: IgnorePointer(
            ignoring: busy,
            child: AuthQuietLink(
              label: createMode
                  ? tr('auth.signUp.signInLink')
                  : tr('auth.signIn.signUpLink'),
              emphasis: true,
              onTap: onToggle,
            ),
          ),
        ),
      ],
    );
  }
}
