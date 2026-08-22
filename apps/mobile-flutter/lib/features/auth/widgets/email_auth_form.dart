import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_typography.dart';
import '../providers/auth_form_controller.dart';
import '../screens/forgot_password_screen.dart';
import 'auth_submit_button.dart';
import 'auth_text_field.dart';

/// The single email path, reached from the welcome screen's "Continue with
/// email". One form, no top tabs: a primary action signs the user in, and a
/// quiet toggle below flips it to account-creation in place — collapsing the
/// old sign-in/sign-up split into one screen.
class EmailAuthForm extends ConsumerStatefulWidget {
  const EmailAuthForm({
    super.key,
    required this.provider,
    required this.onBack,
  });

  final AutoDisposeStateNotifierProvider<AuthFormController, AuthFormState>
      provider;
  final VoidCallback onBack;

  @override
  ConsumerState<EmailAuthForm> createState() => _EmailAuthFormState();
}

class _EmailAuthFormState extends ConsumerState<EmailAuthForm> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _emailError;
  String? _passwordError;
  bool _createMode = false;

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
        // Back to the welcome screen.
        Align(
          alignment: Alignment.centerLeft,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: busy ? null : widget.onBack,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    LucideIcons.arrowLeft300,
                    size: 16,
                    color: KalloColors.textMuted,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    tr('auth.confirm.back'),
                    style: dashBody(color: kInkMuted),
                  ),
                ],
              ),
            ),
          ),
        ),
        Text(
          _createMode
              ? tr('auth.dialog.signUpTitle')
              : tr('auth.dialog.signInTitle'),
          style: KalloTextStyles.serifRegular(
            fontSize: KalloFontSize.h3,
          ).copyWith(color: KalloColors.text),
        ),
        const SizedBox(height: 16),
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
        const SizedBox(height: 16),
        AuthTextField(
          controller: _password,
          label: tr('auth.signIn.password'),
          placeholder: _createMode
              ? tr('auth.signUp.passwordPlaceholder')
              : tr('auth.signIn.passwordPlaceholder'),
          obscureText: true,
          textInputAction: TextInputAction.done,
          autofillHints: _createMode
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
        if (!_createMode) ...[
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: busy
                  ? null
                  : () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const ForgotPasswordScreen(),
                        ),
                      ),
              child: Text(
                tr('auth.signIn.forgotPassword'),
                style: dashMeta(),
              ),
            ),
          ),
        ],
        // Inline auth error — stays put (unlike a toast) and the fields keep
        // their values so the user can correct and retry in place.
        if (state.error != null) ...[
          const SizedBox(height: 12),
          Text(
            state.error!,
            style: dashMeta(color: KalloColors.danger),
          ),
        ],
        const SizedBox(height: 16),
        AuthSubmitButton(
          label: _createMode
              ? tr('auth.signUp.submit')
              : tr('auth.signIn.submit'),
          busy: busy,
          loading: state.emailBusy,
          onPressed: _submit,
        ),
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _createMode
                  ? '${tr('auth.signUp.hasAccount')} '
                  : '${tr('auth.signIn.noAccount')} ',
              style: dashBody(color: kInkMuted),
            ),
            Opacity(
              opacity: busy ? 0.6 : 1.0,
              child: IgnorePointer(
                ignoring: busy,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    _controller.clearMessages();
                    setState(() => _createMode = !_createMode);
                  },
                  child: Text(
                    _createMode
                        ? tr('auth.signUp.signInLink')
                        : tr('auth.signIn.signUpLink'),
                    style: dashBody(color: KalloColors.textMuted, weight: FontWeight.w500),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
