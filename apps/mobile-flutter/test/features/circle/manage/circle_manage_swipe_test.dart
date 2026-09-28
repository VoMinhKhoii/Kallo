import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/screens/circle_manage_screen.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';

import '../../../l10n_test_loader.dart';
import '../circle_feed_test_support.dart';

/// "Edit circle" pages between Friends and Groups under a sideways swipe, and
/// the app-wide back swipe still works from its first tab.
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

  FakeApiClient api() => FakeApiClient((request) async {
    final path = request.path;
    if (path == '/api/v1/groups/friends') {
      return {
        'circle': [
          for (final (id, name) in [('u1', 'Linh'), ('u2', 'Phúc')])
            {
              'friendshipId': 'f-$id',
              'status': 'accepted',
              'profile': {'userId': id, 'handle': id, 'displayName': name},
            },
        ],
      };
    }
    if (path.startsWith('/api/v1/chat-groups?')) {
      return {'groups': const <Object>[]};
    }
    return <String, dynamic>{};
  });

  /// Settings with "Edit circle" pushed on it, as the app does: a
  /// `MaterialPageRoute` under the app's own theme (its back swipe).
  Future<void> pumpPushed(WidgetTester tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: ProviderScope(
          overrides: [apiClientProvider.overrideWithValue(api())],
          child: Builder(
            builder:
                (context) => MaterialApp(
                  theme: kalloAppTheme(),
                  localizationsDelegates: context.localizationDelegates,
                  supportedLocales: context.supportedLocales,
                  locale: context.locale,
                  home: Builder(
                    builder:
                        (context) => Scaffold(
                          body: Center(
                            child: TextButton(
                              onPressed:
                                  () => Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder:
                                          (_) => const CircleManageScreen(
                                            parentTitle: 'Settings',
                                          ),
                                    ),
                                  ),
                              child: const Text('settings-root'),
                            ),
                          ),
                        ),
                  ),
                ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('settings-root'));
    await tester.pumpAndSettle();
    expect(find.byType(CircleManageScreen), findsOneWidget);
    expect(find.text('Linh'), findsOneWidget);
  }

  TabController tabs(WidgetTester tester) =>
      tester.widget<TabBar>(find.byType(TabBar)).controller!;

  Future<void> swipe(WidgetTester tester, double dx) async {
    await tester.timedDragFrom(
      tester.getCenter(find.text('Phúc')),
      Offset(dx, 0),
      const Duration(milliseconds: 300),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a swipe left on the friends pages to Groups', (tester) async {
    await pumpPushed(tester);
    await swipe(tester, -300);
    expect(tabs(tester).index, 1);
    expect(find.byType(CircleManageScreen), findsOneWidget);
  });

  testWidgets('a swipe right on the first tab goes back to Settings', (
    tester,
  ) async {
    await pumpPushed(tester);
    await swipe(tester, 300);
    expect(find.byType(CircleManageScreen), findsNothing);
    expect(find.text('settings-root'), findsOneWidget);
  });

  testWidgets('a swipe right on Groups comes back to Friends, not out', (
    tester,
  ) async {
    await pumpPushed(tester);
    await swipe(tester, -300);
    expect(tabs(tester).index, 1);

    await tester.timedDragFrom(
      const Offset(195, 500),
      const Offset(300, 0),
      const Duration(milliseconds: 300),
    );
    await tester.pumpAndSettle();
    expect(tabs(tester).index, 0);
    expect(find.byType(CircleManageScreen), findsOneWidget);
  });
}
