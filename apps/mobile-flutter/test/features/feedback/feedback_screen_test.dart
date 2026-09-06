import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/feedback/screens/feedback_screen.dart';
import 'package:kallo_mobile/features/feedback/widgets/feedback_fields.dart';
import 'package:kallo_mobile/features/feedback/widgets/feedback_form.dart';
import 'package:kallo_mobile/shared/widgets/chrome/page_header.dart';
import 'package:kallo_mobile/shared/widgets/form/quiet_action_button.dart';

import '../../l10n_test_loader.dart';

/// Feedback is a settings sub-page and must wear the same chrome as the rest
/// of that stack: the title lives in [PageHeader] beside the back chevron and
/// the body never repeats it or describes it back to you.
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
            home: const FeedbackScreen(),
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

  testWidgets('the title is in the header bar and nowhere in the body', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    const title = 'Send feedback';
    expect(
      find.descendant(of: find.byType(PageHeader), matching: find.text(title)),
      findsOneWidget,
    );

    // The submit pill happens to carry the same words, so "not repeated in
    // the body" is: inside the form the string occurs exactly once, and that
    // once is the button — no in-body headline.
    expect(
      find.descendant(
        of: find.byType(FeedbackForm),
        matching: find.text(title),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(QuietActionButton),
        matching: find.text(title),
      ),
      findsOneWidget,
    );

    // The description and the message label both restated their surroundings
    // and are gone; the type question is not a restatement, so it stays.
    expect(
      find.text(
        'Found a bug, missing an ingredient, or have an idea? '
        'It goes straight to the team.',
      ),
      findsNothing,
    );
    expect(find.text('Your message'), findsNothing);
    expect(find.text("What's this about?"), findsOneWidget);
  });

  testWidgets('the type control offers three options and switching one '
      'switches the message placeholder', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.byType(FeedbackTypeChip), findsNWidgets(3));
    expect(find.text('Bug'), findsOneWidget);
    expect(find.text('Ingredient'), findsOneWidget);
    expect(find.text('Idea'), findsOneWidget);

    // 'bug' is the default.
    expect(
      find.text('What went wrong? What did you expect to happen?'),
      findsOneWidget,
    );

    await tester.tap(find.text('Idea'));
    await tester.pumpAndSettle();

    expect(
      find.text('What went wrong? What did you expect to happen?'),
      findsNothing,
    );
    expect(find.text('What would make Kallo better for you?'), findsOneWidget);
  });

  testWidgets('the message field takes more than one line', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final field = find.byType(TextField);
    expect(tester.widget<TextField>(field).maxLines, 6);

    await tester.enterText(field, 'line one\nline two\nline three');
    await tester.pumpAndSettle();

    expect(
      tester.widget<TextField>(field).controller!.text,
      'line one\nline two\nline three',
    );
  });

  testWidgets('submit is disabled until the message has content', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final submit = find.byType(QuietActionButton);
    expect(tester.widget<QuietActionButton>(submit).enabled, isFalse);
    // Whitespace is not content either.
    await tester.enterText(find.byType(TextField), '   ');
    await tester.pumpAndSettle();
    expect(tester.widget<QuietActionButton>(submit).enabled, isFalse);

    await tester.enterText(find.byType(TextField), 'the keyboard eats taps');
    await tester.pumpAndSettle();
    expect(tester.widget<QuietActionButton>(submit).enabled, isTrue);
    expect(tester.widget<QuietActionButton>(submit).onTap, isNotNull);
  });
}
