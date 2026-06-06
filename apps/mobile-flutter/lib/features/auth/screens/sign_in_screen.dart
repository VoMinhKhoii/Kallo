import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../widgets/auth_dialog.dart';

/// The sign-in route.
///
/// Matches web `components/auth/auth-dialog.tsx`: a centered modal card over a
/// dimmed, blurred backdrop with two in-place tabs. This route opens the dialog
/// on the sign-in tab; the in-dialog footer/segmented control switches to
/// sign-up in place (no route change).
class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: NhamColors.surface,
      body: AuthDialog(initialSignIn: true),
    );
  }
}
