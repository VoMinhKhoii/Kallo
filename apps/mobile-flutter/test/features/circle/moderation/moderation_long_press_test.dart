import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/features/circle/widgets/replies/reply_row.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_pressable.dart';

import '../../../l10n_test_loader.dart';
import '../circle_feed_test_support.dart';

/// Long-press → Report / Block on other people's posts and replies (App Store
/// 1.2), and nothing on the viewer's own.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpL10nBinding();

  CircleFeedEntry post({bool isSelf = false}) => CircleFeedEntry(
    friend: const CircleProfile(
      userId: 'u2',
      handle: 'mai',
      displayName: 'Mai',
    ),
    isSelf: isSelf,
    meal: CircleFeedMeal(
      mealId: 'm1',
      shareId: 's1',
      rawInput: 'Bún chả Hà Nội',
      sharedAt: DateTime.now().toUtc().toIso8601String(),
    ),
    reactions: const ShareReactions(count: 0),
  );

  FakeApiClient api() => FakeApiClient((request) async {
    if (request.path == '/api/v1/reports') return {'id': 'r1'};
    return <String, dynamic>{};
  });

  Future<void> pumpPost(
    WidgetTester tester,
    FakeApiClient api, {
    bool isSelf = false,
  }) => pumpCircleScreen(
    tester,
    FeedEntry(entry: post(isSelf: isSelf), onReply: () {}, onOpen: () {}),
    api: api,
    expand: true,
    size: const Size(390, 844),
  );

  testWidgets("long-pressing a friend's post offers Report post and Block", (
    tester,
  ) async {
    final backend = api();
    await pumpPost(tester, backend);

    await tester.longPress(find.text('Bún chả Hà Nội'));
    await tester.pumpAndSettle();
    expect(find.text('Report post'), findsOneWidget);
    expect(find.text('Block Mai'), findsOneWidget);

    await tester.tap(find.text('Report post'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Spam'));
    await tester.pumpAndSettle();

    final report = backend.requests.singleWhere((r) => r.method == 'POST');
    expect(report.body, {
      'targetKind': 'share',
      'targetId': 's1',
      'reason': 'spam',
    });
  });

  testWidgets('your own post has no menu', (tester) async {
    await pumpPost(tester, api(), isSelf: true);

    await tester.longPress(find.text('Bún chả Hà Nội'));
    await tester.pumpAndSettle();
    expect(find.text('Report post'), findsNothing);
  });

  testWidgets('pressing a post paints no grey slab', (tester) async {
    await pumpPost(tester, api());

    final pressable = tester.widget<KalloPressable>(
      find.byType(KalloPressable).first,
    );
    expect(pressable.wash, isFalse);
  });

  testWidgets("long-pressing a friend's reply reports the reply", (
    tester,
  ) async {
    final backend = api();
    await pumpCircleScreen(
      tester,
      ReplyRow(
        reply: ShareReply(
          id: 'r9',
          author: const CircleProfile(
            userId: 'u3',
            handle: 'linh',
            displayName: 'Linh',
          ),
          isSelf: false,
          body: 'Ngon quá!',
          createdAt: DateTime.utc(2026, 9, 28),
        ),
        locale: 'en',
      ),
      api: backend,
      expand: true,
    );

    await tester.longPress(find.text('Ngon quá!'));
    await tester.pumpAndSettle();
    expect(find.text('Report reply'), findsOneWidget);
    await tester.tap(find.text('Report reply'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Something else'));
    await tester.pumpAndSettle();

    expect(backend.requests.singleWhere((r) => r.method == 'POST').body, {
      'targetKind': 'reply',
      'targetId': 'r9',
      'reason': 'other',
    });
  });
}
