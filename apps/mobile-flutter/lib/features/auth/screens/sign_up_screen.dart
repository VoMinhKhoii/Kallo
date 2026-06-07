import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../widgets/auth_page.dart';

/// The sign-up route.
///
/// A flat full-page auth surface (header, in-place Sign in / Sign up toggle,
/// Google button, divider, form, footer) on the cream surface. Opens on the
/// sign-up tab; the toggle/footer switches to sign-in in place (no route change).
class SignUpScreen extends StatelessWidget {
  const SignUpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: NhamColors.surface,
      body: AuthPage(initialSignIn: false),
    );
  }
}
