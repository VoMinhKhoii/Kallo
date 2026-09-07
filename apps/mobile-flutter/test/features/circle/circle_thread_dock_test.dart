import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/replies/reply_row.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/thread_composer.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

/// The composer dock grows to four lines; the body's tail reserve must grow
/// with it, or a long draft covers the last reply and nothing can scroll it
/// back into view. This is the repo's own documented trap — a hard-coded box
/// for a thing whose height is text.
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

  testWidgets('a four-line draft never covers the last reply', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final api = FakeApiClient(
      (request) => switch (request.path) {
        '/api/v1/groups/friends/feed' => pageJson([
          entryJson('s1', replies: [
            for (var i = 0; i < 8; i++) replyJson('r$i'),
          ]),
        ], null),
        '/api/v1/groups/friends/read-marker' => {
          'lastReadAt': '2026-07-18T00:00:00.000Z',
        },
        _ => unexpectedRequest(request),
      },
    );
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: ProviderScope(
          overrides: [apiClientProvider.overrideWithValue(api)],
          child: Builder(
            builder: (context) => MaterialApp(
              localizationsDelegates: context.localizationDelegates,
              supportedLocales: context.supportedLocales,
              locale: context.locale,
              home: const CircleThreadScreen(shareId: 's1'),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    Future<void> scrollToEnd() async {
      await tester.drag(
        find.byType(SingleChildScrollView).first,
        const Offset(0, -5000),
      );
      await tester.pumpAndSettle();
    }

    // One-line composer: the last reply clears the dock once scrolled.
    await scrollToEnd();
    final oneLineComposer = tester.getRect(find.byType(ThreadComposer));
    expect(
      tester.getRect(find.byType(ReplyRow).last).bottom,
      lessThanOrEqualTo(oneLineComposer.top),
      reason: 'baseline: with an empty composer the last reply is reachable',
    );

    // Four-line draft: the dock is taller now, so the reserve must be too.
    await tester.enterText(
      find.byKey(const Key('reply-composer')),
      'one\ntwo\nthree\nfour',
    );
    await tester.pumpAndSettle();
    await scrollToEnd();
    final fourLineComposer = tester.getRect(find.byType(ThreadComposer));
    expect(
      fourLineComposer.height,
      greaterThan(oneLineComposer.height + 40),
      reason: 'this fixture must actually grow the dock, or it proves nothing',
    );
    expect(
      tester.getRect(find.byType(ReplyRow).last).bottom,
      lessThanOrEqualTo(fourLineComposer.top),
      reason: 'the grown dock covers the last reply and it cannot be '
          'scrolled clear — the reserve did not grow with the dock',
    );
  });
}
