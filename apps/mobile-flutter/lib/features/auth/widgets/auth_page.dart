import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/supabase_service.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../providers/auth_form_controller.dart';
import 'apple_button.dart';
import 'auth_divider.dart';
import 'confirm_email_view.dart';
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

  // The welcome + email surfaces share one controller (single path).
  static final _provider = signInControllerProvider;

  AuthFormController get _controller => ref.read(_provider.notifier);

  AppLifecycleListener? _lifecycle;

  @override
  void initState() {
    super.initState();
    // OAuth hands off to Safari; on return the deep-link observer completes the
    // PKCE exchange. If the app resumes still signed-out, the user cancelled —
    // drop the "Finishing sign-in…" pending state so it doesn't hang.
    _lifecycle = AppLifecycleListener(
      onResume: () {
        final state = ref.read(_provider);
        if (state.googleBusy &&
            SupabaseService.client.auth.currentSession == null) {
          _controller.clearMessages();
          // Clear the in-flight action so the overlay drops.
          ref.read(_provider.notifier).resetAction();
        }
      },
    );
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    super.dispose();
  }

  void _toast(String message) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;
    messenger
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: NhamColors.cardCream,
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            side: const BorderSide(color: NhamColors.border),
          ),
          content: Text(
            message,
            style: NhamTextStyles.sansMedium(
              fontSize: NhamFontSize.sm,
            ).copyWith(color: NhamColors.text),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_provider);
    final showConfirm = state.pendingEmail != null;

    // Which face: confirm-email > email form > welcome.
    final Widget face;
    if (showConfirm) {
      face = ConfirmEmailView(
        key: const ValueKey('confirm'),
        provider: _provider,
        onNotice: _toast,
      );
    } else if (_mode == _AuthMode.email) {
      face = EmailAuthForm(
        key: const ValueKey('email'),
        provider: _provider,
        onError: _toast,
        onBack: () => setState(() => _mode = _AuthMode.welcome),
      );
    } else {
      face = _welcome(state);
    }

    return Stack(
      children: [
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(
                horizontal: 32,
                vertical: 32,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  switchInCurve: Curves.easeOut,
                  switchOutCurve: Curves.easeIn,
                  transitionBuilder: (child, animation) => FadeTransition(
                    opacity: animation,
                    child: child,
                  ),
                  layoutBuilder: (currentChild, previousChildren) => Stack(
                    alignment: Alignment.center,
                    children: [
                      ...previousChildren,
                      if (currentChild != null) currentChild,
                    ],
                  ),
                  child: face,
                ),
              ),
            ),
          ),
        ),
        // OAuth app-switch: a calm "Finishing sign-in…" hold so the surface
        // never sits blank or spins indefinitely after Safari returns.
        if (state.googleBusy) const _FinishingOverlay(),
      ],
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
            'Nhẩm',
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
          onPressed: () => setState(() => _mode = _AuthMode.email),
        ),
        const SizedBox(height: 18),
        Text(
          tr('auth.welcome.terms'),
          textAlign: TextAlign.center,
          style: NhamTextStyles.sansRegular(
            fontSize: NhamFontSize.xs,
            height: NhamLeading.normal,
          ).copyWith(color: NhamColors.textMuted),
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
            style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
                .copyWith(color: NhamColors.text, letterSpacing: -0.2),
          ),
        ),
      ),
    );
  }
}

/// A calm full-bleed "Finishing sign-in…" hold shown while the OAuth browser
/// round-trip completes after Safari returns.
class _FinishingOverlay extends StatelessWidget {
  const _FinishingOverlay();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: ColoredBox(
        color: NhamColors.surface80,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: NhamColors.accent,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                tr('auth.pending.finishing'),
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
