import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/toast/top_toast.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../providers/auth_form_controller.dart';
import 'auth_controls.dart';
import 'confirm_email_view.dart';
import 'email_auth_form.dart';
import 'welcome/auth_options.dart';
import 'welcome/welcome_view.dart';

/// Which face of the auth surface is showing.
enum _AuthMode { welcome, email }

/// The auth surface as a full-bleed page on the cream surface.
///
/// Replaces the old "login wall titled Welcome back". It now lands on a real
/// pre-auth **welcome screen**: the Lora wordmark, a typing demo resolving into
/// a point result, then three stacked social/email options. "Continue with
/// email" cross-fades to a single email path (no sign-in/sign-up tab split). A
/// successful sign-up cross-fades again to a real "Check your email" state with
/// a resend-cooldown, instead of a SnackBar that vanishes before it's read.
class AuthPage extends ConsumerStatefulWidget {
  const AuthPage({super.key, this.compact = false});

  /// Presented under someone else's chrome (`/save-plan`): the welcome face is
  /// the bare [AuthOptions] stack, bottom-anchored and on a tighter vertical
  /// inset, so the three options sit under the host's title instead of under a
  /// second wordmark.
  final bool compact;

  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage> {
  _AuthMode _mode = _AuthMode.welcome;

  /// Drives the face-switch slide direction: true = advancing (welcome → email),
  /// false = going back. Lets the transition read as forward/back navigation.
  bool _forward = true;

  // The welcome + email surfaces share one controller (single path).
  static final _provider = signInControllerProvider;

  AuthFormController get _controller => ref.read(_provider.notifier);

  void _toast(String message) {
    showTopToast(context, message, variant: TopToastVariant.error);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_provider);
    final showConfirm = state.pendingEmail != null;

    // Errors raised while the email form is on screen render inline there.
    // Anything else (OAuth on the welcome face, a failed resend on the
    // confirm face) would otherwise be invisible — toast those.
    ref.listen<AuthFormState>(_provider, (prev, next) {
      final err = next.error;
      final emailFormShowing =
          _mode == _AuthMode.email && next.pendingEmail == null;
      if (err != null && err != prev?.error && !emailFormShowing) {
        _toast(err);
        _controller.clearMessages();
      }
    });

    // Which face: confirm-email > email form > welcome. The key also tells the
    // switcher's transitionBuilder which child is incoming vs outgoing.
    final Key currentKey =
        showConfirm
            ? const ValueKey('confirm')
            : _mode == _AuthMode.email
            ? const ValueKey('email')
            : const ValueKey('welcome');

    final Widget face;
    if (showConfirm) {
      face = ConfirmEmailView(provider: _provider, onNotice: _toast);
    } else if (_mode == _AuthMode.email) {
      face = EmailAuthForm(
        provider: _provider,
        onBack:
            () => setState(() {
              _forward = false;
              _mode = _AuthMode.welcome;
            }),
      );
    } else {
      // One options stack, two hosts: on its own screen it wears the brand
      // block, as a guest under someone else's chrome it is the whole face.
      final options = AuthOptions(
        busy: state.busy,
        googleBusy: state.googleBusy,
        onApple: _controller.signInWithApple,
        onGoogle: _controller.signInWithGoogle,
        onEmail:
            () => setState(() {
              _forward = true;
              _mode = _AuthMode.email;
            }),
      );
      face = widget.compact ? options : WelcomeView(options: options);
    }

    // Each face is a full-screen, opaque page so switching reads as an
    // iOS-style full-page push (not a content cross-fade). The opaque fill lets
    // the incoming page cover the outgoing one as it slides across.
    final Widget page = ColoredBox(
      key: currentKey,
      color: KalloColors.surface,
      child: SafeArea(
        child: Align(
          // Compact is a GUEST on someone else's screen (`/save-plan`), whose
          // title sits above it: centring the options in the leftover space
          // floats them in the middle of nothing. Anchored to the bottom, the
          // stack reads as the screen's action, the way the canvas has it.
          alignment:
              widget.compact ? Alignment.bottomCenter : Alignment.center,
          child: SingleChildScrollView(
            // 24 side inset — auth's documented exception to the app's 12pt
            // page rhythm (native pass, 2026-08-31). Nothing here is a card on
            // a canvas; it is a single centred column, and 12 let a 50pt pill
            // run almost edge to edge.
            padding: EdgeInsets.symmetric(
              horizontal: kAuthInset,
              vertical:
                  widget.compact ? KalloSpacing.sp3 : KalloSpacing.sp8,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: face,
            ),
          ),
        ),
      ),
    );

    // Native Google/Apple sheets are in-process, so the surface is just the
    // face switcher — no "Finishing sign-in…" overlay (that only covered the
    // old OAuth Safari app-switch); the button's own spinner holds the brief
    // native token exchange.
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 340),
      transitionBuilder: (child, animation) {
        // Incoming slides a full width in from the lead side; outgoing
        // parallax-slides a little the opposite way, beneath it. Direction
        // flips on "back" via [_forward].
        final incoming = child.key == currentKey;
        final dir = _forward ? 1.0 : -1.0;
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
        );
        final begin = incoming ? Offset(dir, 0) : Offset(-dir * 0.25, 0);
        return SlideTransition(
          position: Tween<Offset>(
            begin: begin,
            end: Offset.zero,
          ).animate(curved),
          child: child,
        );
      },
      layoutBuilder:
          (currentChild, previousChildren) => Stack(
            children: [
              ...previousChildren,
              if (currentChild != null) currentChild,
            ],
          ),
      child: page,
    );
  }
}
