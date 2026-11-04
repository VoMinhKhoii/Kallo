import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/notifications/logic/reminder_categories.dart';
import 'package:kallo_mobile/services/push/push_channel.dart';

import '../../l10n_test_loader.dart';

/// The lock screen once showed `notifications.reminderActions.logMeal` as a
/// button title: the categories were registered above the app's localizations,
/// before easy_localization had loaded a string. Mounted where the app mounts
/// it (inside `MaterialApp`), it must register real titles.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final calls = <MethodCall>[];
  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(kPushMethodChannel, (call) async {
          calls.add(call);
          return null;
        });
  });

  testWidgets('registers the reminder buttons with translated titles', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: EasyLocalization(
          supportedLocales: const [Locale('en')],
          path: 'assets/l10n',
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: Builder(
            builder:
                (context) => MaterialApp(
                  localizationsDelegates: context.localizationDelegates,
                  supportedLocales: context.supportedLocales,
                  locale: context.locale,
                  builder:
                      (context, child) =>
                          ReminderCategories(child: child ?? const SizedBox()),
                  home: const SizedBox(),
                ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final registered = calls.where((c) => c.method == 'setReminderCategories');
    expect(registered.length, 1);
    final args = Map<String, Object?>.from(registered.single.arguments as Map);
    expect(args['apiBase'], isA<String>());
    final titles = Map<String, Object?>.from(args['titles']! as Map);
    expect(titles, containsPair('logMeal', 'Log a meal'));
    expect(titles, containsPair('thatWasAll', 'That was all'));
    expect(titles, containsPair('doneForToday', "I'm done for today"));
    for (final value in titles.values) {
      expect(value.toString(), isNot(startsWith('notifications.')));
    }
  });
}
