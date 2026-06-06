import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../providers/auth_form_controller.dart';
import 'auth_divider.dart';
import 'auth_tab_toggle.dart';
import 'google_button.dart';
import 'sign_in_form.dart';
import 'sign_up_form.dart';

/// The auth modal.
///
/// 1:1 with web `components/auth/auth-dialog.tsx`: a centered card over a
/// dimmed, blurred backdrop, holding two in-place tabs (sign in / sign up) that
/// share the Google button + divider and cross-fade/slide the form on switch.
///
/// On Flutter the auth surface is a full route (the router gates signed-out
/// users here), so the backdrop is presentation-only — there is no page behind
/// it to dismiss back to.
class AuthDialog extends ConsumerStatefulWidget {
  const AuthDialog({super.key, this.initialSignIn = true});

  /// Which tab opens first. `/sign-in` → true, `/sign-up` → false.
  final bool initialSignIn;

  @override
  ConsumerState<AuthDialog> createState() => _AuthDialogState();
}

class _AuthDialogState extends ConsumerState<AuthDialog>
    with SingleTickerProviderStateMixin {
  late bool _signIn = widget.initialSignIn;

  // Spring(stiffness 400, damping 30) ≈ a ~270ms easeOutBack-ish settle.
  late final AnimationController _enter = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 270),
  )..forward();

  @override
  void dispose() {
    _enter.dispose();
    super.dispose();
  }

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
            style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
                .copyWith(color: NhamColors.text),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Backdrop: bg-[#2C2416]/40 backdrop-blur-sm, fade 0→1 over 200ms.
        Positioned.fill(
          child: FadeTransition(
            opacity: CurvedAnimation(
              parent: _enter,
              // Backdrop is a plain 200ms fade (independent of the spring).
              curve: const Interval(0.0, 0.74, curve: Curves.easeOut),
            ),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
              child: const ColoredBox(color: Color(0x662C2416)),
            ),
          ),
        ),

        // Centered card.
        Center(
          child: Padding(
            // w-[calc(100%-2rem)] → 16px gutter each side.
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: _buildEntrance(child: _card(context)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEntrance({required Widget child}) {
    return AnimatedBuilder(
      animation: _enter,
      builder: (context, c) {
        final t = Curves.easeOutBack.transform(_enter.value);
        final fade = Curves.easeOut.transform(_enter.value);
        // scale 0.95→1, y 10→0, opacity 0→1.
        final scale = 0.95 + 0.05 * t;
        final dy = 10.0 * (1 - t);
        return Opacity(
          opacity: fade.clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(0, dy),
            child: Transform.scale(scale: scale, child: c),
          ),
        );
      },
      child: child,
    );
  }

  Widget _card(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: NhamColors.cardCream, // #FFFCF8
        borderRadius: BorderRadius.circular(NhamRadii.containerLg), // 16
        border: Border.all(color: NhamColors.borderBiscotti40), // #E8D5B5/40
        boxShadow: const [
          // 0 25px 60px -12px rgba(44,36,22,0.25)
          BoxShadow(
            color: Color(0x402C2416),
            blurRadius: 60,
            spreadRadius: -12,
            offset: Offset(0, 25),
          ),
          // 0 0 0 1px rgba(201,168,124,0.08)
          BoxShadow(
            color: Color(0x14C9A87C),
            blurRadius: 0,
            spreadRadius: 1,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _header(),
          _tabToggle(),
          _googleBlock(),
          _formBlock(),
        ],
      ),
    );
  }

  // px-8 pt-8 pb-2, centered.
  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 32, 32, 8),
      child: Column(
        children: [
          Text(
            _signIn
                ? tr('auth.dialog.signInTitle')
                : tr('auth.dialog.signUpTitle'),
            textAlign: TextAlign.center,
            // Lora w400, 24px (text-2xl), #2C2416.
            style: NhamTextStyles.serifRegular(fontSize: NhamFontSize.h3)
                .copyWith(color: NhamColors.text),
          ),
          const SizedBox(height: 4), // mb-1
          Text(
            _signIn
                ? tr('auth.dialog.signInSubtitle')
                : tr('auth.dialog.signUpSubtitle'),
            textAlign: TextAlign.center,
            // text-sm #8B7355 DM Sans.
            style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.sm)
                .copyWith(color: NhamColors.textMuted),
          ),
        ],
      ),
    );
  }

  // px-8 pt-4 pb-2.
  Widget _tabToggle() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 16, 32, 8),
      child: AuthTabToggle(
        signInActive: _signIn,
        onSignIn: () => _setTab(true),
        onSignUp: () => _setTab(false),
        signInLabel: tr('auth.dialog.signInTab'),
        signUpLabel: tr('auth.dialog.signUpTab'),
      ),
    );
  }

  // space-y-3, px-8, pt-4.
  Widget _googleBlock() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 16, 32, 0),
      child: Column(
        children: [
          GoogleButton(
            busy: ref.watch(
              _signIn ? signInControllerProvider : signUpControllerProvider,
            ).busy,
            onPressed: ref
                .read(
                  (_signIn ? signInControllerProvider : signUpControllerProvider)
                      .notifier,
                )
                .signInWithGoogle,
          ),
          const SizedBox(height: 12), // space-y-3
          const AuthDivider(),
        ],
      ),
    );
  }

  // px-8 pt-4 pb-6.
  Widget _formBlock() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 16, 32, 24),
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
                  builder: (context, c) => Transform.translate(
                    offset: Offset(beginDx * (1 - animation.value), 0),
                    child: c,
                  ),
                  child: child,
                ),
              );
            },
            child: _signIn
                ? SignInForm(key: const ValueKey('sign-in'), onError: _toast)
                : SignUpForm(
                    key: const ValueKey('sign-up'),
                    onError: _toast,
                    onNotice: _toast,
                  ),
          ),
          const SizedBox(height: 20), // mt-5
          _footer(),
        ],
      ),
    );
  }

  Widget _footer() {
    final prompt = _signIn
        ? tr('auth.signIn.noAccount')
        : tr('auth.signUp.hasAccount');
    final action =
        _signIn ? tr('auth.signIn.signUpLink') : tr('auth.signUp.signInLink');
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          '$prompt ',
          style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.sm)
              .copyWith(color: NhamColors.textMuted),
        ),
        _FooterLink(label: action, onTap: () => _setTab(!_signIn)),
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
        style: NhamTextStyles.sansSemiBold(fontSize: NhamFontSize.sm)
            .copyWith(color: _pressed ? _hover : NhamColors.accent),
        child: Text(widget.label),
      ),
    );
  }
}
