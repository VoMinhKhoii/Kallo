import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shell/header/app_header_back_button.dart';
import '../../../shell/nav/nav_actions.dart';
import '../../../theme/kallo_colors.dart';
import '../widgets/auth_page.dart';

/// The sign-in route.
///
/// Lands on the pre-auth welcome screen (wordmark, typing demo, three social/
/// email options). "Continue with email" cross-fades to a single email path;
/// sign-up cross-fades to a "Check your email" state. No top tab split.
///
/// The chevron lives HERE and not in [AuthPage], which `/save-plan` also shows
/// under its own chrome — a chevron in there would be the second one on that
/// screen. It is not a [PageHeader] either: that requires a title rendered at
/// page-title size, and this screen's headline is the wordmark inside
/// `AuthBrandHero`, which a second heading over it would fight.
///
/// It appears only when there is something to pop, which is the case that
/// matters: `/start`'s "I already have an account" PUSHES here, so the way
/// back is the screen the user just left. Reached any other way — the sign-out
/// row, a deleted account, an invite that needs an account — this route is the
/// whole stack and a chevron would be a button that does nothing.
class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final canGoBack = GoRouter.of(context).canPop();
    return Scaffold(
      backgroundColor: KalloColors.surface,
      body: Stack(
        children: [
          const AuthPage(),
          if (canGoBack)
            SafeArea(
              child: Padding(
                // The gutter every other back chevron in the flow stands on,
                // so the glyph does not move between `/start` and here.
                padding: const EdgeInsets.only(left: WordmarkBar.rowInset),
                child: Align(
                  alignment: Alignment.topLeft,
                  child: AppHeaderBackButton(
                    onBack: () =>
                        popOr(context, (router) => router.go('/start')),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
