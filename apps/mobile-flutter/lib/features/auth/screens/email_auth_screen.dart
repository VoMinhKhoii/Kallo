import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shared/widgets/panes/narrative_panes.dart';

import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../shell/nav/nav_actions.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../onboarding/widgets/backdrop/step_backdrop.dart';
import '../../onboarding/widgets/start/start_hero.dart';
import '../providers/auth_form_controller.dart';
import '../widgets/auth_controls.dart';
import '../widgets/email_auth_form.dart';
import '../widgets/email_code_view.dart';
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
/// email" and then changing your mind costs no navigation. Once a code is
/// sent, the code-entry state replaces the form in place.
class EmailAuthScreen extends ConsumerStatefulWidget {
  const EmailAuthScreen({super.key, required this.createAccount});

  /// Which title the screen wears. Comes from the route: `/save-plan/email` is
  /// reached by someone who just built a plan and has no account yet, so it
  /// reads "Create your account"; `/sign-in/email` reads "Welcome back". The
  /// form is the same either way — the code creates the account if needed.
  final bool createAccount;

  @override
  ConsumerState<EmailAuthScreen> createState() => _EmailAuthScreenState();
}

class _EmailAuthScreenState extends ConsumerState<EmailAuthScreen> {
  /// Held tall, the fold crosses the window at half its height, and with the
  /// form centred that line ran through "Send code". This much lower it falls
  /// in the gap between the email field and the button instead. The extra
  /// top padding is twice this because the form is centred in what is left.
  static const double _foldNudge = 24;

  final _taskKey = GlobalKey();
  static final _provider = signInControllerProvider;

  AuthFormController get _controller => ref.read(_provider.notifier);

  void _toast(String message) {
    showTopToast(context, message, variant: TopToastVariant.error);
  }

  void _back() => popOr(context, (router) => router.go('/sign-in'));

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_provider);
    final showCode = state.pendingEmail != null;

    final task = CustomScrollView(
      key: _taskKey,
      slivers: [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              kAuthInset,
              KalloSpacing.sp5 +
                  (WindowLayout.of(context).foldAcross ? 2 * _foldNudge : 0),
              kAuthInset,
              KalloSpacing.sp5,
            ),
            child: Align(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child:
                    showCode
                        ? EmailCodeView(provider: _provider, onNotice: _toast)
                        : _form(state),
              ),
            ),
          ),
        ),
      ],
    );
    return Scaffold(
      backgroundColor: KalloColors.surface,
      body: Stack(
        children: [
          // Outside the SafeArea on purpose: the sweep starts at the very top
          // of the screen, behind the status bar, exactly as it does on the
          // `/save-plan` screen this route is pushed from.
          const Positioned.fill(child: StepBackdrop()),
          _panes(
            SafeArea(
              minimum: EdgeInsets.only(
                top: MediaQuery.viewPaddingOf(context).top == 0 ? 12 : 0,
              ),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: WordmarkBar.rowInset,
                    ),
                    child: WordmarkBar(
                      leading: AuthBackButton(
                        onBack: state.busy ? null : _back,
                      ),
                    ),
                  ),
                  // Centred in the space under the wordmark, as the welcome face
                  // is, rather than hung off the top with the bottom half empty.
                  // A phone too short for it (or the keyboard) scrolls instead.
                  Expanded(child: task),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Beside the fold the whole column is the near pane and the start preview
  /// keeps the far one.
  Widget _panes(Widget column) =>
      NarrativePanes(far: const StartHero(), near: column, single: column);

  Widget _form(AuthFormState state) {
    // A window this short (a phone or the closed Duo on its side) cannot show
    // the form down to Google. The subtitle is the one line it can lose, and
    // the seams around the form close up the last few points.
    final short = WindowLayout.of(context).compactHeight;
    final seam = SizedBox(height: short ? KalloSpacing.sp3 : KalloSpacing.sp5);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The page title, in the sans page-title token. It was Lora 26 — the
        // serif is the wordmark's voice now, and the wordmark is right above it.
        Text(
          widget.createAccount
              ? tr('auth.dialog.signUpTitle')
              : tr('auth.dialog.signInTitle'),
          style: kPageTitle(),
        ),
        if (!short) ...[
          const SizedBox(height: KalloSpacing.sp2),
          Text(
            widget.createAccount
                ? tr('auth.dialog.signUpSubtitle')
                : tr('auth.dialog.signInSubtitle'),
            style: dashBody(color: kInkMuted),
          ),
        ],
        seam,
        EmailAuthForm(provider: _provider),
        seam,
        const _OrDivider(),
        seam,
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
    final line = Expanded(child: Divider(color: KalloColors.border, height: 1));
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
