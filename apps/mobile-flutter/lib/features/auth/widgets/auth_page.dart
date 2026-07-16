import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../providers/auth_form_controller.dart';
import 'apple_button.dart';
import 'auth_divider.dart';
import 'confirm_email_view.dart';
import '../../../shared/widgets/top_toast.dart';
import 'email_auth_form.dart';
import 'google_button.dart';
import 'welcome_demo.dart';

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
  const AuthPage({super.key});

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
    final Key currentKey = showConfirm
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
        onBack: () => setState(() {
          _forward = false;
          _mode = _AuthMode.welcome;
        }),
      );
    } else {
      face = _welcome(state);
    }

    // Each face is a full-screen, opaque page so switching reads as an
    // iOS-style full-page push (not a content cross-fade). The opaque fill lets
    // the incoming page cover the outgoing one as it slides across.
    final Widget page = ColoredBox(
      key: currentKey,
      color: NhamColors.surface,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 32),
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
          position: Tween<Offset>(begin: begin, end: Offset.zero)
              .animate(curved),
          child: child,
        );
      },
      layoutBuilder: (currentChild, previousChildren) => Stack(
        children: [
          ...previousChildren,
          if (currentChild != null) currentChild,
        ],
      ),
      child: page,
    );
  }

  Widget _welcome(AuthFormState state) {
    final showApple =
        defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS;
    return Column(
      key: const ValueKey('welcome'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Wordmark.
        Center(
          child: Text(
            'Kallo',
            style: NhamTextStyles.serifRegular(
              fontSize: 28,
            ).copyWith(color: NhamColors.text),
          ),
        ),
        const SizedBox(height: 14),
        // Tagline — sentence, with the second clause italic-tan.
        Text.rich(
          TextSpan(
            children: [
              TextSpan(text: '${tr('auth.welcome.tagline')} '),
              TextSpan(
                text: tr('auth.welcome.taglineHighlight'),
                style: NhamTextStyles.serifItalic(
                  fontSize: NhamFontSize.h3,
                ).copyWith(color: NhamColors.accent),
              ),
            ],
          ),
          textAlign: TextAlign.center,
          style: NhamTextStyles.serifRegular(
            fontSize: NhamFontSize.h3,
            height: NhamLeading.snug,
          ).copyWith(color: NhamColors.text),
        ),
        const SizedBox(height: 28),
        const WelcomeDemo(),
        const SizedBox(height: 28),
        if (showApple) ...[
          AppleButton(busy: state.busy, onPressed: _controller.signInWithApple),
          const SizedBox(height: 12),
        ],
        GoogleButton(
          busy: state.busy,
          loading: state.googleBusy,
          onPressed: _controller.signInWithGoogle,
        ),
        const SizedBox(height: 12),
        const AuthDivider(),
        const SizedBox(height: 12),
        _EmailEntryButton(
          busy: state.busy,
          onPressed: () => setState(() {
            _forward = true;
            _mode = _AuthMode.email;
          }),
        ),
        const SizedBox(height: 18),
        Text(
          tr('auth.welcome.terms'),
          textAlign: TextAlign.center,
          style: dashMeta(),
        ),
      ],
    );
  }
}

/// "Continue with email" — a ghost button matching the Google button shape but
/// without a logo, so the three options read as one stack.
class _EmailEntryButton extends StatefulWidget {
  const _EmailEntryButton({required this.onPressed, required this.busy});

  final VoidCallback onPressed;
  final bool busy;

  @override
  State<_EmailEntryButton> createState() => _EmailEntryButtonState();
}

class _EmailEntryButtonState extends State<_EmailEntryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final fill = _pressed ? NhamColors.cardCream : NhamColors.elev;
    return Opacity(
      opacity: widget.busy ? 0.6 : 1.0,
      child: GestureDetector(
        onTapDown: widget.busy ? null : (_) => setState(() => _pressed = true),
        onTapUp: widget.busy ? null : (_) => setState(() => _pressed = false),
        onTapCancel:
            widget.busy ? null : () => setState(() => _pressed = false),
        onTap: widget.busy ? null : widget.onPressed,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp4,
            vertical: NhamSpacing.sp3,
          ),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            border: Border.all(color: NhamColors.border),
          ),
          alignment: Alignment.center,
          child: Text(
            tr('auth.welcome.continueWithEmail'),
            style: dashBody(weight: FontWeight.w500)
                .copyWith(color: NhamColors.text, letterSpacing: -0.2),
          ),
        ),
      ),
    );
  }
}
