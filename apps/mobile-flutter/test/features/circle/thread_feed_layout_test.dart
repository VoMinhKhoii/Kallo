import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/thread_feed.dart';
import 'package:kallo_mobile/features/circle/widgets/states/circle_error.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_surface_state.dart';
import 'package:kallo_mobile/shared/widgets/brand/surface_illustration.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

/// Where the wall's empty and failed surfaces sit.
///
/// The header (view switcher, group title) stays at the top of the page; the
/// state itself owns everything under it and sits at the middle of that, not
/// pinned to the header's underside with the rest of the page empty.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const viewport = Size(390, 700);
  const headerKey = Key('feed-header');
  const headerHeight = 60.0;

  setUpL10nBinding();

  // `expand`: a tight height, like the `Expanded` the real page hands it.
  Future<void> pumpFeed(
    WidgetTester tester,
    AsyncValue<SharedMealFeedState> feed,
  ) => pumpCircleScreen(
    tester,
    ThreadFeed(
      feed: feed,
      header: const SizedBox(key: headerKey, height: headerHeight),
      onRefresh: () async {},
      onRetry: () {},
      onAddFriend: () {},
    ),
    size: viewport,
    expand: true,
    decodeAssets: true,
  );

  /// The state's own content — illustration through action — against the
  /// middle of the space under the header, and the state's BOX against the
  /// same middle.
  ///
  /// Both, because they are two different claims: the content extremes say the
  /// state reads as centred, and the box says [KalloSurfaceState] hugs its
  /// content under the fill sliver's `Center` instead of filling the region.
  void expectCentredUnderHeader(WidgetTester tester) {
    final headerBottom = tester.getRect(find.byKey(headerKey)).bottom;
    // The gap between header and state is paid at the top of the state's own
    // region, so the midpoint is measured from below it.
    final top = headerBottom + KalloSpacing.sp3;
    final contentTop = tester.getRect(find.byType(SurfaceIllustration)).top;
    final contentBottom = tester.getRect(find.byType(KalloButton)).bottom;
    expect(
      (contentTop + contentBottom) / 2,
      moreOrLessEquals(top + (viewport.height - top) / 2, epsilon: 1),
    );
    expect(
      contentTop - top,
      greaterThan(KalloSpacing.sp3),
      reason: 'the state must not hug the header with the page empty below',
    );
    // The box itself, not just what it holds.
    final box = tester.getRect(find.byType(KalloSurfaceState));
    expect(
      box.center.dy,
      moreOrLessEquals(top + (viewport.height - top) / 2, epsilon: 1),
    );
    expect(
      box.height,
      lessThan(viewport.height - top - 50),
      reason: 'the state must hug its content, not fill the region',
    );
  }

  testWidgets('the empty wall sits in the middle under its header', (
    tester,
  ) async {
    await pumpFeed(
      tester,
      const AsyncData(SharedMealFeedState(entries: [], nextCursor: null)),
    );
    expect(find.text('No shared meals yet'), findsOneWidget);
    expectCentredUnderHeader(tester);
  });

  testWidgets('the failed wall sits in the middle under its header', (
    tester,
  ) async {
    await pumpFeed(tester, AsyncError(Exception('offline'), StackTrace.empty));
    expect(find.byType(CircleErrorCard), findsOneWidget);
    expectCentredUnderHeader(tester);
  });

  testWidgets('a thread with no replies stands its cast under the post, '
      'centred', (tester) async {
    // The thread's empty state is the same illustrated surface, `compact`,
    // under the post. It lives inside a start-aligned column, so it only
    // reads as centred because it is handed the full width — drop that and
    // the capybara and its copy sit hard against the left edge.
    final api = FakeApiClient(
      (request) =>
          request.path == '/api/v1/groups/friends/feed'
              ? pageJson([entryJson('s1')], null)
              : readMarker(request),
    );
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: api,
      size: viewport,
      decodeAssets: true,
    );

    expect(find.text('No replies yet'), findsOneWidget);
    final cast = find.byType(SurfaceIllustration);
    expect(cast, findsOneWidget);
    final state = tester.getRect(find.byType(KalloSurfaceState));
    expect(state.width, moreOrLessEquals(viewport.width - 2 * 12, epsilon: 1));
    expect(
      tester.getRect(cast).center.dx,
      moreOrLessEquals(state.center.dx, epsilon: 1),
    );
  });
}
