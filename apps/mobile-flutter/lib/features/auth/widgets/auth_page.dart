import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../providers/auth_form_controller.dart';
import 'apple_button.dart';
import 'auth_divider.dart';
import 'google_button.dart';
import 'sign_in_form.dart';
import 'sign_up_form.dart';

/// The auth surface as a full-bleed page.
///
/// Ported from web `components/auth/auth-dialog.tsx`, but rendered as a flat
/// page on the cream surface rather than a modal: no dimmed/blurred backdrop and
/// no floating card. It keeps the same content (header, Google button +
/// divider, form, footer) and cross-fades between the Sign in / Sign up forms;
/// the footer link is the only tab switch (the top toggle was removed).
class AuthPage extends ConsumerStatefulWidget {
  const AuthPage({super.key, this.initialSignIn = true});

  /// Which tab opens first. `/sign-in` → true, `/sign-up` → false.
  final bool initialSignIn;

  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage> {
  late bool _signIn = widget.initialSignIn;

  void _setTab(bool signIn) {
    if (_signIn == signIn) return;
    setState(() => _signIn = signIn);
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
    final provider =
        _signIn ? signInControllerProvider : signUpControllerProvider;
    final state = ref.watch(provider);

    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          // Page gutter (32) + maxWidth 420 → a 356px content column, matching
          // the old card's px-8 inner width so spacing/line lengths are 1:1.
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _header(),
                _socialBlock(state, ref.read(provider.notifier)),
                _formBlock(state),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // pb-2, centered.
  Widget _header() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          Text(
            _signIn
                ? tr('auth.dialog.signInTitle')
                : tr('auth.dialog.signUpTitle'),
            textAlign: TextAlign.center,
            // Lora w400, 24px (text-2xl), #2C2416.
            style: NhamTextStyles.serifRegular(
              fontSize: NhamFontSize.h3,
            ).copyWith(color: NhamColors.text),
          ),
          const SizedBox(height: 4), // mb-1
          Text(
            _signIn
                ? tr('auth.dialog.signInSubtitle')
                : tr('auth.dialog.signUpSubtitle'),
            textAlign: TextAlign.center,
            // text-sm #8B7355 DM Sans.
            style: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.sm,
            ).copyWith(color: NhamColors.textMuted),
          ),
        ],
      ),
    );
  }

  // space-y-3, pt-4.
  Widget _socialBlock(AuthFormState state, AuthFormController controller) {
    // Sign in with Apple is iOS/macOS-only (and an App Store requirement
    // there); placed above Google as the most prominent social option.
    final showApple =
        defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        children: [
          if (showApple) ...[
            AppleButton(
              busy: state.busy,
              onPressed: controller.signInWithApple,
            ),
            const SizedBox(height: 12), // space-y-3
          ],
          GoogleButton(
            busy: state.busy,
            loading: state.googleBusy,
            onPressed: controller.signInWithGoogle,
          ),
          const SizedBox(height: 12), // space-y-3
          const AuthDivider(),
        ],
      ),
    );
  }

  // pt-4.
  Widget _formBlock(AuthFormState state) {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Tab-switch cross-fade + 10px horizontal slide, 150ms, mode 'wait'.
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 150),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            transitionBuilder: (child, animation) {
              final incomingSignIn = (child.key == const ValueKey('sign-in'));
              // sign-in enters from x:-10, sign-up from x:+10.
              final beginDx = incomingSignIn ? -10.0 : 10.0;
              return FadeTransition(
                opacity: animation,
                child: AnimatedBuilder(
                  animation: animation,
                  builder:
                      (context, c) => Transform.translate(
                        offset: Offset(beginDx * (1 - animation.value), 0),
                        child: c,
                      ),
                  child: child,
                ),
              );
            },
            child:
                _signIn
                    ? SignInForm(
                      key: const ValueKey('sign-in'),
                      onError: _toast,
                    )
                    : SignUpForm(
                      key: const ValueKey('sign-up'),
                      onError: _toast,
                      onNotice: _toast,
                    ),
          ),
          const SizedBox(height: 20), // mt-5
          _footer(state),
        ],
      ),
    );
  }

  Widget _footer(AuthFormState state) {
    final prompt =
        _signIn ? tr('auth.signIn.noAccount') : tr('auth.signUp.hasAccount');
    final action =
        _signIn ? tr('auth.signIn.signUpLink') : tr('auth.signUp.signInLink');
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          '$prompt ',
          style: NhamTextStyles.sansRegular(
            fontSize: NhamFontSize.sm,
          ).copyWith(color: NhamColors.textMuted),
        ),
        // Inert while a request is in flight — same guard as the tab toggle.
        Opacity(
          opacity: state.busy ? 0.6 : 1.0,
          child: IgnorePointer(
            ignoring: state.busy,
            child: _FooterLink(label: action, onTap: () => _setTab(!_signIn)),
          ),
        ),
      ],
    );
  }
}

/// Inline tab-switch link: `font-semibold text-[#C9A87C]
/// hover:text-[#A88B63] transition-colors`.
class _FooterLink extends StatefulWidget {
  const _FooterLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  State<_FooterLink> createState() => _FooterLinkState();
}

class _FooterLinkState extends State<_FooterLink> {
  bool _pressed = false;

  // Web hover color is #A88B63 (distinct from the accentDark token #B89968).
  static const Color _hover = Color(0xFFA88B63);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedDefaultTextStyle(
        duration: const Duration(milliseconds: 200), // transition-colors
        style: NhamTextStyles.sansSemiBold(
          fontSize: NhamFontSize.sm,
        ).copyWith(color: _pressed ? _hover : NhamColors.accent),
        child: Text(widget.label),
      ),
    );
  }
}
