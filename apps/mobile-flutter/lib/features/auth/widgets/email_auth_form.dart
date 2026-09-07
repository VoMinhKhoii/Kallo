import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../providers/auth_form_controller.dart';
import '../screens/forgot_password_screen.dart';
import 'auth_controls.dart';
import 'auth_mode_toggle.dart';

import 'auth_submit_button.dart';
import 'auth_text_field.dart';

/// The single email path, reached from the welcome screen's "Continue with
/// email". One form, no top tabs: a primary action signs the user in, and a
/// quiet toggle below flips it to account-creation in place — collapsing the
/// old sign-in/sign-up split into one screen.
///
/// The form only — its chrome (the wordmark row with the back chevron, the
/// page title, the social options under it) belongs to [EmailAuthScreen], the
/// route that hosts it. The title tracks the mode the toggle sets, which is
/// why the flip is announced back out through [onModeChanged].
class EmailAuthForm extends ConsumerStatefulWidget {
  const EmailAuthForm({
    super.key,
    required this.provider,
    this.initialCreateMode = false,
    this.onModeChanged,
  });

  final AutoDisposeStateNotifierProvider<AuthFormController, AuthFormState>
  provider;

  /// Which mode the form opens in: account-creation when reached from the
  /// post-onboarding "Save your plan" step, sign-in from `/sign-in`.
  final bool initialCreateMode;

  /// Fires with the new mode whenever the quiet toggle flips the form, so the
  /// host can retitle the page.
  final ValueChanged<bool>? onModeChanged;

  @override
  ConsumerState<EmailAuthForm> createState() => _EmailAuthFormState();
}

class _EmailAuthFormState extends ConsumerState<EmailAuthForm> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _emailError;
  String? _passwordError;
  late bool _createMode = widget.initialCreateMode;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  AuthFormController get _controller => ref.read(widget.provider.notifier);

  bool _validate() {
    final email = _email.text.trim();
    final emailOk = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email);
    final passOk = _password.text.length >= 6;
    setState(() {
      _emailError = emailOk ? null : tr('auth.signIn.emailError');
      _passwordError = passOk ? null : tr('auth.signIn.passwordError');
    });
    return emailOk && passOk;
  }

  /// Flip sign-in ↔ sign-up in place.
  ///
  /// The field errors were raised against the submit the user just attempted,
  /// so they do not survive the flip: a red line under an untouched field on
  /// the mode you have only now arrived at reads as a complaint about THIS
  /// form. The typed text DOES survive — changing your mind should not cost a
  /// retype.
  void _switchMode() {
    _controller.clearMessages();
    setState(() {
      _emailError = null;
      _passwordError = null;
      _createMode = !_createMode;
    });
    widget.onModeChanged?.call(_createMode);
  }

  void _submit() {
    if (!_validate()) return;
    if (_createMode) {
      _controller.signUp(email: _email.text, password: _password.text);
    } else {
      _controller.signInWithEmail(email: _email.text, password: _password.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(widget.provider);
    final busy = state.busy;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthTextField(
          controller: _email,
          label: tr('auth.signIn.email'),
          placeholder: tr('auth.signIn.emailPlaceholder'),
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.email],
          enabled: !busy,
          errorText: _emailError,
          onChanged: (_) {
            if (_emailError != null) setState(() => _emailError = null);
            _controller.clearMessages();
          },
        ),
        const SizedBox(height: KalloSpacing.sp3),
        AuthTextField(
          controller: _password,
          label: tr('auth.signIn.password'),
          placeholder:
              _createMode
                  ? tr('auth.signUp.passwordPlaceholder')
                  : tr('auth.signIn.passwordPlaceholder'),
          obscureText: true,
          textInputAction: TextInputAction.done,
          autofillHints:
              _createMode
                  ? const [AutofillHints.newPassword]
                  : const [AutofillHints.password],
          onSubmitted: (_) => _submit(),
          enabled: !busy,
          errorText: _passwordError,
          onChanged: (_) {
            if (_passwordError != null) setState(() => _passwordError = null);
            _controller.clearMessages();
          },
        ),
        // Inline auth error — stays put (unlike a toast) and the fields keep
        // their values so the user can correct and retry in place.
        if (state.error != null) ...[
          const SizedBox(height: KalloSpacing.sp3),
          Text(state.error!, style: dashMeta(color: KalloColors.danger)),
        ],
        const SizedBox(height: KalloSpacing.sp5),
        AuthSubmitButton(
          label:
              _createMode ? tr('auth.signUp.submit') : tr('auth.signIn.submit'),
          busy: busy,
          loading: state.emailBusy,
          onPressed: _submit,
        ),
        // Forgot password sits UNDER the CTA now, centred (native pass,
        // 2026-08-31): above it, right-aligned, it competed with the field it
        // hung off and pushed the two inputs apart. Below the button it reads
        // as the quiet alternative to the action just offered.
        if (!_createMode)
          Center(
            child: AuthQuietLink(
              label: tr('auth.signIn.forgotPassword'),
              onTap:
                  busy
                      ? null
                      : () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const ForgotPasswordScreen(),
                        ),
                      ),
            ),
          ),
        const SizedBox(height: KalloSpacing.sp5),
        AuthModeToggle(
          createMode: _createMode,
          busy: busy,
          onToggle: _switchMode,
        ),
      ],
    );
  }
}
