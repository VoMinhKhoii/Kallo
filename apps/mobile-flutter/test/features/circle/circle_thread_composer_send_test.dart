import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/reply_pill.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/thread_composer.dart';
import 'package:kallo_mobile/shared/widgets/avatar/profile_avatar.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import 'circle_feed_test_support.dart';

/// What the reply dock gained on 2026-09-22: a send button that is genuinely
/// ABSENT until there is something to send and sits BESIDE the pill rather than
/// inside it, a uniform inset around the viewer's disc, and a pull-to-refresh
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

  testWidgets('the disc sits an equal gap from all four of the pill\'s edges', (
    tester,
  ) async {
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: feedWith(entryJson('s1')),
    );

    Rect pill() => tester.getRect(find.byType(ReplyPill));
    Rect disc() => tester.getRect(
      find.descendant(
        of: find.byType(ReplyPill),
        matching: find.byType(ProfileAvatarDisc),
      ),
    );

    // The bug this pins: the pill padded only its left (6) while the disc sat
    // in the send button's 44pt box (8 above and below), so a 28pt face read as
    // sitting high in its own hole.
    //
    // Three edges, not four: the pill's right edge is the FIELD's side, so the
    // disc says nothing about it.
    void expectUniform(String when) {
      final p = pill();
      final d = disc();
      final gaps = [d.left - p.left, d.top - p.top, p.bottom - d.bottom];
      for (final gap in gaps) {
        expect(gap, closeTo(gaps.first, 0.5), reason: '$when: $gaps');
      }
    }

    expectUniform('at rest');
    final resting = pill();
    final left = disc().left;
    expect(
      resting.height,
      closeTo(KalloIcons.hit, 0.5),
      reason: 'a resting pill is the disc plus its two gaps: 28 + 2 × 8',
    );

    // Focused, the ring thickens 1 → 2 and NOTHING moves: the pill's padding
    // subtracts the stroke, so the outer box and the disc hold still.
    await tester.tap(find.byType(ReplyPill));
    await tester.pumpAndSettle();
    expect(pill().height, closeTo(resting.height, 0.5));
    expect(disc().left, closeTo(left, 0.5));
    expectUniform('focused');
  });

  testWidgets('a draft shortens the pill and the button takes the room', (
    tester,
  ) async {
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: feedWith(entryJson('s1')),
    );

    final dock = tester.getRect(find.byType(ThreadComposer));
    // At rest the capsule is unbroken all the way to the dock's own inset —
    // the button used to live inside it and hold a 44pt hole open for itself.
    expect(
      tester.getRect(find.byType(ReplyPill)).right,
      closeTo(dock.right - KalloSpacing.sp3, 0.5),
    );

    await tester.enterText(find.byKey(const Key('reply-composer')), 'k');
    await tester.pumpAndSettle();

    final pill = tester.getRect(find.byType(ReplyPill));
    final send = tester.getRect(sendButton);
    expect(
      pill.right,
      lessThan(dock.right - KalloSpacing.sp3),
      reason: 'the pill has to give the room back, not overlap the button',
    );
    expect(send.right, closeTo(dock.right - KalloSpacing.sp3, 0.5));

    // The button stands exactly as tall as the field it sends — so it is
    // LARGER than the disc inside the pill, not a small disc floating in a
    // 44pt box. That box's slack used to read as extra gap.
    expect(send.height, closeTo(pill.height, 0.5));
    expect(send.center.dy, closeTo(pill.center.dy, 0.5));
    final composerDisc = tester.getRect(
      find.descendant(
        of: find.byType(ReplyPill),
        matching: find.byType(ProfileAvatarDisc),
      ),
    );
    expect(send.height, greaterThan(composerDisc.height));

    // ONE gap: field-to-button equals disc-to-border inside the pill.
    expect(
      send.left - pill.right,
      closeTo(composerDisc.left - pill.left, 0.5),
      reason:
          'the space between the field and the button reads as the same gap '
          'as the one around the disc, or it looks like two decisions',
    );
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
