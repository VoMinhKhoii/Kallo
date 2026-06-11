import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../providers/auth_form_controller.dart';
import '../screens/forgot_password_screen.dart';
import 'auth_submit_button.dart';
import 'auth_text_field.dart';

/// In-dialog sign-in form.
///
/// Matches web `components/auth/sign-in-form.tsx`: a `space-y-4` (16px) stack of
/// email + password fields and the espresso submit button. Validation is
/// per-field (zod: email format, password min 6) surfacing inline red messages;
/// Supabase errors arrive via a transient toast (handled by the controller's
/// caller).
class SignInForm extends ConsumerStatefulWidget {
  const SignInForm({super.key, required this.onError});

  /// Surfaces a Supabase error message as a transient toast.
  final void Function(String message) onError;

  @override
  ConsumerState<SignInForm> createState() => _SignInFormState();
}

class _SignInFormState extends ConsumerState<SignInForm> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _emailError;
  String? _passwordError;
  bool _wasBusy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  AuthFormController get _controller =>
      ref.read(signInControllerProvider.notifier);

  // zod: z.email() + z.string().min(6).
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
    _controller.signInWithEmail(email: _email.text, password: _password.text);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(signInControllerProvider);
    final busy = state.busy;

    // Surface a Supabase error as a toast once the request settles.
    if (_wasBusy && !busy && state.error != null) {
      final msg = state.error!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onError(msg);
        _controller.clearMessages();
      });
    }
    _wasBusy = busy;

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
          },
        ),
        const SizedBox(height: 16), // space-y-4
        AuthTextField(
          controller: _password,
          label: tr('auth.signIn.password'),
          placeholder: tr('auth.signIn.passwordPlaceholder'),
          obscureText: true,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.password],
          onSubmitted: (_) => _submit(),
          enabled: !busy,
          errorText: _passwordError,
          onChanged: (_) {
            if (_passwordError != null) setState(() => _passwordError = null);
          },
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap:
                busy
                    ? null
                    : () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const ForgotPasswordScreen(),
                      ),
                    ),
            child: Text(
              tr('auth.signIn.forgotPassword'),
              style: NhamTextStyles.sansRegular(
                fontSize: 12,
              ).copyWith(color: NhamColors.textMuted),
            ),
          ),
        ),
        const SizedBox(height: 16), // space-y-4
        AuthSubmitButton(
          label: tr('auth.signIn.submit'),
          busy: busy,
          loading: state.emailBusy,
          onPressed: _submit,
        ),
      ],
    );
  }
}
