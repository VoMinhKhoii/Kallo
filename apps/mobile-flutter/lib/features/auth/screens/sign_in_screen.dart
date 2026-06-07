import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../widgets/auth_page.dart';

/// The sign-in route.
///
/// A flat full-page auth surface (header, in-place Sign in / Sign up toggle,
/// Google button, divider, form, footer) on the cream surface. Opens on the
/// sign-in tab; the toggle/footer switches to sign-up in place (no route change).
class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: NhamColors.surface,
      body: AuthPage(initialSignIn: true),
    );
  }
}
