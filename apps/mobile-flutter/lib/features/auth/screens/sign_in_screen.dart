import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../widgets/auth_page.dart';

/// The sign-in route.
///
/// Lands on the pre-auth welcome screen (wordmark, typing demo, three social/
/// email options). "Continue with email" cross-fades to a single email path;
/// sign-up cross-fades to a "Check your email" state. No top tab split.
class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: NhamColors.surface,
      body: AuthPage(),
    );
  }
}
