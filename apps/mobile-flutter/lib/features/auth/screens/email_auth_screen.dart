import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../shell/nav/nav_actions.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../onboarding/widgets/backdrop/step_backdrop.dart';
import '../providers/auth_form_controller.dart';
import '../widgets/auth_controls.dart';
import '../widgets/confirm_email_view.dart';
import '../widgets/email_auth_form.dart';
import '../widgets/welcome/apple_button.dart';
import '../widgets/welcome/auth_legal_links.dart';
import '../widgets/welcome/google_button.dart';

/// The email path as its own route — `/sign-in/email`, or `/save-plan/email`
/// when it was reached from the post-onboarding "Save your plan" step.
///
/// It used to be a face swapped inside [AuthPage], which meant the system back
/// gesture left the whole auth surface instead of returning to the options, and
/// the two entry points could not open in different modes. As a route it gets a
/// real back stack: the chevron in the wordmark row pops to whichever screen
/// pushed it.
///
/// It wears the wizard's [StepBackdrop] — the dialled-down top sweep and the
/// four blobs — because both of its entry points do: `/save-plan/email` is
/// pushed straight off `/save-plan`, and a flat surface here would read as
/// leaving onboarding rather than as one more step of it.
///
/// Apple and Google sit UNDER the form, past an "or" rule, driven by the same
/// [signInControllerProvider] as the welcome face — so choosing "Continue with
/// email" and then changing your mind costs no navigation. The post-sign-up
/// "check your email" state stays here, replacing the form in place.
class EmailAuthScreen extends ConsumerStatefulWidget {
  const EmailAuthScreen({super.key, required this.createAccount});

  /// Which mode the form opens in. Comes from the route: `/save-plan/email` is
  /// reached by someone who just built a plan and has no account yet, so it
  /// opens on sign-UP; `/sign-in/email` opens on sign-in.
  final bool createAccount;

  @override
  ConsumerState<EmailAuthScreen> createState() => _EmailAuthScreenState();
}

class _EmailAuthScreenState extends ConsumerState<EmailAuthScreen> {
  static final _provider = signInControllerProvider;

  late bool _createMode = widget.createAccount;

  AuthFormController get _controller => ref.read(_provider.notifier);

  void _toast(String message) {
    showTopToast(context, message, variant: TopToastVariant.error);
  }

  void _back() => popOr(context, (router) => router.go('/sign-in'));

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_provider);
    final showConfirm = state.pendingEmail != null;

    return Scaffold(
      backgroundColor: KalloColors.surface,
      body: Stack(
        children: [
          // Outside the SafeArea on purpose: the sweep starts at the very top
          // of the screen, behind the status bar, exactly as it does on the
          // `/save-plan` screen this route is pushed from.
          const Positioned.fill(child: StepBackdrop()),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: WordmarkBar.rowInset,
                  ),
                  child: WordmarkBar(
                    leading: AuthBackButton(onBack: state.busy ? null : _back),
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    // 24 side inset — auth's documented exception to the 12pt page
                    // rhythm ([kAuthInset]).
                    padding: const EdgeInsets.symmetric(
                      horizontal: kAuthInset,
                      vertical: KalloSpacing.sp5,
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child:
                            showConfirm
                                ? ConfirmEmailView(
                                  provider: _provider,
                                  onNotice: _toast,
                                )
                                : _form(state),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _form(AuthFormState state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The page title, in the sans page-title token. It was Lora 26 — the
        // serif is the wordmark's voice now, and the wordmark is right above it.
        Text(
          _createMode
              ? tr('auth.dialog.signUpTitle')
              : tr('auth.dialog.signInTitle'),
          style: kPageTitle(),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Text(
          _createMode
              ? tr('auth.dialog.signUpSubtitle')
              : tr('auth.dialog.signInSubtitle'),
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: KalloSpacing.sp5),
        EmailAuthForm(
          provider: _provider,
          initialCreateMode: widget.createAccount,
          onModeChanged: (create) => setState(() => _createMode = create),
        ),
        const SizedBox(height: KalloSpacing.sp5),
        const _OrDivider(),
        const SizedBox(height: KalloSpacing.sp5),
        // The same two social options the welcome face offers, on the same
        // controller — so nobody has to go back to reach them.
        AppleButton(busy: state.busy, onPressed: _controller.signInWithApple),
        const SizedBox(height: KalloSpacing.sp3),
        GoogleButton(
          busy: state.busy,
          loading: state.googleBusy,
          onPressed: _controller.signInWithGoogle,
        ),
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

/// A hairline rule with the word "or" set into it — the seam between the email
/// form and the two social options under it.
class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    const line = Expanded(child: Divider(color: KalloColors.border, height: 1));
    return Row(
      children: [
        line,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: Text(
            tr('auth.email.or'),
            style: dashMeta().copyWith(fontSize: kAuthFootnote),
          ),
        ),
        line,
      ],
    );
  }
}
