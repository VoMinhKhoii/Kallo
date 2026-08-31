import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/auth/providers/auth_form_controller.dart';
import 'package:kallo_mobile/features/auth/widgets/email_auth_form.dart';

import '../../l10n_test_loader.dart';

/// Sign-in and sign-up are ONE form now, flipped in place by the quiet toggle
/// underneath it. The field validation errors are raised against the submit
/// the user just attempted, so they must not survive the flip: a red "Enter a
/// valid email address" hanging under an untouched field on the screen you
/// just arrived at reads as a complaint about the new mode.
final _provider =
    StateNotifierProvider.autoDispose<AuthFormController, AuthFormState>(
      AuthFormController.new,
    );

Widget _app() => ProviderScope(
      child: EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: Scaffold(
              body: SingleChildScrollView(
                child: EmailAuthForm(provider: _provider, onBack: () {}),
              ),
            ),
          ),
        ),
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('switching sign-in → sign-up drops the validation error but '
      'keeps the typed email', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    // An invalid address, submitted: both field errors surface. (Validation
    // fails before any network call, so nothing reaches Supabase.)
    await tester.enterText(find.byType(TextField).first, 'not-an-email');
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email address'), findsOneWidget);
    expect(find.text('Password must be at least 6 characters'), findsOneWidget);

    // Flip to sign-up.
    await tester.tap(find.text('Sign up'));
    await tester.pumpAndSettle();
    expect(find.text('Create Account'), findsOneWidget,
        reason: 'the form did not switch to sign-up');

    // The errors were raised against the sign-in submit — they must not carry.
    expect(find.text('Enter a valid email address'), findsNothing,
        reason: 'the email validation error carried over the mode switch');
    expect(find.text('Password must be at least 6 characters'), findsNothing,
        reason: 'the password validation error carried over');

    // The typed address survives: changing your mind should not cost a retype.
    expect(
      tester.widget<TextField>(find.byType(TextField).first).controller?.text,
      'not-an-email',
    );
  });
}
