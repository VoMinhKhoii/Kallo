import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/toast/top_toast.dart';
import '../../onboarding/widgets/backdrop/step_backdrop.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../providers/auth_form_controller.dart';
import 'auth_controls.dart';
import 'welcome/auth_options.dart';
import 'welcome/welcome_view.dart';

/// The pre-auth WELCOME face on the onboarding gradient: the wordmark and its
/// one line, then the three ways in anchored to the bottom.
///
/// "Continue with email" pushes `/sign-in/email` (or `/save-plan/email` under
/// the onboarding chrome) rather than swapping a face in place — the email path
/// is a route now, so the system back gesture returns here instead of leaving
/// the auth surface, and the two entry points can open in different modes.
class AuthPage extends ConsumerStatefulWidget {
  const AuthPage({super.key, this.compact = false, this.background});

  /// Presented under someone else's chrome (`/save-plan`): the bare
  /// [AuthOptions] stack, bottom-anchored on a tighter inset, so the options
  /// sit under the host's title instead of a second wordmark.
  ///
  /// It is also what says WHERE the email route is pushed from — `/save-plan`
  /// is the only compact host, and its email screen must pop back to it.
  final bool compact;

  /// Painted behind the face. MUST be opaque. Defaults to the canvas under the
  /// onboarding's [StepBackdrop] — the field the email route this face pushes
  /// also stands on, so the push keeps its background. `/save-plan` passes a
  /// slice of that same field, aligned to its own full-screen copy.
  final Widget? background;

  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage> {
  // The welcome face and the email route share one controller (single path).
  static final _provider = signInControllerProvider;

  AuthFormController get _controller => ref.read(_provider.notifier);

  void _toast(String message) {
    showTopToast(context, message, variant: TopToastVariant.error);
  }

  void _openEmail() {
    context.push(widget.compact ? '/save-plan/email' : '/sign-in/email');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_provider);

    // OAuth failures raised on THIS face would otherwise be invisible — toast
    // them. Errors raised on the pushed email route render inline there, and
    // this page is still mounted underneath it, so only toast while it is the
    // route on top.
    ref.listen<AuthFormState>(_provider, (prev, next) {
      final err = next.error;
      final isCurrent = ModalRoute.of(context)?.isCurrent ?? true;
      if (err != null && err != prev?.error && isCurrent) {
        _toast(err);
        _controller.clearMessages();
      }
    });

    // One options stack, two hosts: on its own screen it wears the brand
    // block, as a guest under someone else's chrome it is the whole face.
    final options = AuthOptions(
      busy: state.busy,
      googleBusy: state.googleBusy,
      onApple: _controller.signInWithApple,
      onGoogle: _controller.signInWithGoogle,
      onEmail: _openEmail,
    );
    final Widget face =
        widget.compact ? options : WelcomeView(options: options);

    // 24 side inset — auth's documented exception to the 12pt page rhythm
    // (native pass, 2026-08-31): a single centred column, where 12 let a 50pt
    // pill run almost edge to edge.
    final Widget column = ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: face,
    );

    final Widget content = SafeArea(
      child:
          widget.compact
              // Compact is a GUEST on someone else's screen, whose title sits
              // above it: centred in the leftover space the options float in
              // the middle of nothing, so the stack anchors to the bottom.
              ? Align(
                alignment: Alignment.bottomCenter,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: kAuthInset,
                    vertical: KalloSpacing.sp3,
                  ),
                  child: column,
                ),
              )
              // On its own screen the face fills the safe area, so the welcome
              // can hang its buttons off the bottom; a phone too short for it
              // (or very large text) scrolls instead of overflowing.
              //
              // The padding sits INSIDE the fill: a SliverPadding around it
              // leaves the trailing inset out of the fill's extent, so the
              // face ran 12pt past the safe area and always scrolled by 12.
              : CustomScrollView(
                slivers: [
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        kAuthInset,
                        KalloSpacing.sp8,
                        kAuthInset,
                        KalloSpacing.sp3,
                      ),
                      child: Center(child: column),
                    ),
                  ),
                ],
              ),
    );

    return Stack(
      children: [
        Positioned.fill(
          child:
              widget.background ??
              const ColoredBox(
                color: KalloColors.surface,
                child: StepBackdrop(),
              ),
        ),
        content,
      ],
    );
  }
}
