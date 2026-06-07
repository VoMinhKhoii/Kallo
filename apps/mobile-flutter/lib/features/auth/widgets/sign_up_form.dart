import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_form_controller.dart';
import 'auth_submit_button.dart';
import 'auth_text_field.dart';

/// In-dialog sign-up form.
///
/// Matches web `components/auth/sign-up-form.tsx`: a `space-y-4` (16px) stack of
/// email + password fields and the espresso submit button. Validation is
/// per-field (zod: email format, password min 6). Both the Supabase error and
/// the "check your email" success are delivered as transient toasts (web uses
/// sonner) rather than inline paragraphs.
class SignUpForm extends ConsumerStatefulWidget {
  const SignUpForm({super.key, required this.onError, required this.onNotice});

  final void Function(String message) onError;
  final void Function(String message) onNotice;

  @override
  ConsumerState<SignUpForm> createState() => _SignUpFormState();
}

class _SignUpFormState extends ConsumerState<SignUpForm> {
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
      ref.read(signUpControllerProvider.notifier);

  bool _validate() {
    final email = _email.text.trim();
    final emailOk = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email);
    final passOk = _password.text.length >= 6;
    setState(() {
      _emailError = emailOk ? null : tr('auth.signUp.emailError');
      _passwordError = passOk ? null : tr('auth.signUp.passwordError');
    });
    return emailOk && passOk;
  }

  void _submit() {
    if (!_validate()) return;
    _controller.signUp(email: _email.text, password: _password.text);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(signUpControllerProvider);
    final busy = state.busy;

    if (_wasBusy && !busy) {
      if (state.error != null) {
        final msg = state.error!;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          widget.onError(msg);
          _controller.clearMessages();
        });
      } else if (state.notice != null) {
        final msg = state.notice!;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          widget.onNotice(msg);
          _controller.clearMessages();
        });
      }
    }
    _wasBusy = busy;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthTextField(
          controller: _email,
          label: tr('auth.signUp.email'),
          placeholder: tr('auth.signUp.emailPlaceholder'),
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
          label: tr('auth.signUp.password'),
          placeholder: tr('auth.signUp.passwordPlaceholder'),
          obscureText: true,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.newPassword],
          onSubmitted: (_) => _submit(),
          enabled: !busy,
          errorText: _passwordError,
          onChanged: (_) {
            if (_passwordError != null) setState(() => _passwordError = null);
          },
        ),
        const SizedBox(height: 16), // space-y-4
        AuthSubmitButton(
          label: tr('auth.signUp.submit'),
          busy: busy,
          loading: state.emailBusy,
          onPressed: _submit,
        ),
      ],
    );
  }
}
