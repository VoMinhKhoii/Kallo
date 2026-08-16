import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../widgets/auth_page.dart';

/// The sign-up route.
///
/// Renders the same pre-auth welcome surface as `/sign-in` — the sign-in/sign-up
/// split is collapsed into one path, so both routes land on the welcome screen.
class SignUpScreen extends StatelessWidget {
  const SignUpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: KalloColors.surface,
      body: AuthPage(),
    );
  }
}
