import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../widgets/auth_dialog.dart';

/// The sign-up route.
///
/// Matches web `components/auth/auth-dialog.tsx`: a centered modal card over a
/// dimmed, blurred backdrop with two in-place tabs. This route opens the dialog
/// on the sign-up tab; the in-dialog footer/segmented control switches to
/// sign-in in place (no route change).
class SignUpScreen extends StatelessWidget {
  const SignUpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: NhamColors.surface,
      body: AuthDialog(initialSignIn: false),
    );
  }
}
