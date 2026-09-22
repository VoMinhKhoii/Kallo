import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';

import 'circle_feed_test_support.dart';

/// The two behaviours the reply dock gained on 2026-09-22: a send button that
/// is genuinely ABSENT until there is something to send, and a pull-to-refresh
/// on a page that had none.
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

  Iterable<Request> feedFetches(FakeApiClient api) =>
      api.requests.where((r) => r.path == '/api/v1/groups/friends/feed');

  FakeApiClient feedWith(Map<String, dynamic> entry) => FakeApiClient(
    (request) =>
        request.path == '/api/v1/groups/friends/feed'
            ? pageJson([entry], null)
            : readMarker(request),
  );

  final sendButton = find.byKey(const Key('reply-send'));

  testWidgets('the send button arrives with the draft and leaves with it', (
    tester,
  ) async {
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: feedWith(entryJson('s1')),
    );

    // Not dimmed, not a zero-opacity target a screen reader would still
    // announce: nothing is there at all.
    expect(sendButton, findsNothing);

    await tester.enterText(find.byKey(const Key('reply-composer')), 'k');
    await tester.pumpAndSettle();
    expect(sendButton, findsOneWidget);

    // Whitespace is not a draft — the button has to go back where it came
    // from, or the field reads as armed with nothing in it.
    await tester.enterText(find.byKey(const Key('reply-composer')), '   ');
    await tester.pumpAndSettle();
    expect(sendButton, findsNothing);
  });

  testWidgets('pulling the thread down refetches its post', (tester) async {
    final api = feedWith(entryJson('s1'));
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: api,
      // A tight, page-sized box: the pull is a scroll gesture, and a loose
      // `home` lets the body shrink-wrap to its content with nothing to
      // overscroll.
      expand: true,
    );
    expect(feedFetches(api), hasLength(1));

    // Past `CupertinoSliverRefreshControl.refreshTriggerPullDistance` (100),
    // held rather than flung — a fling springs back before the control arms.
    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(FeedEntry)),
    );
    for (var i = 0; i < 15; i++) {
      await gesture.moveBy(const Offset(0, 20));
      await tester.pump();
    }
    await gesture.up();
    await tester.pumpAndSettle();

    expect(
      feedFetches(api),
      hasLength(2),
      reason: 'the pull has to reach the feed the page reads its post from',
    );
  });
}
