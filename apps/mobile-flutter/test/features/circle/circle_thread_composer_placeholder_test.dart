import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

/// Whose conversation the reply composer says you are writing into.
///
/// The placeholder names the post's author, which is right on a friend's post
/// and wrong on your own: `friend` is YOU there, so the field read "Reply to
/// khoa…" — the app addressing the user by their own handle. Your own post
/// falls back to the bare "Reply…" (`groups.feed.replyPlaceholder`).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpL10nBinding();

  /// The feed the thread page reads its post out of, holding one post that is
  /// either a friend's or the viewer's own.
  Future<void> pumpThread(WidgetTester tester, {required bool isSelf}) async {
    final api = FakeApiClient(
      (request) => switch (request.path) {
        '/api/v1/groups/friends/feed' => pageJson([
          // Spread-and-override rather than a new support-file knob: the only
          // thing this file varies is the one flag.
          {...entryJson('s1'), 'isSelf': isSelf},
        ], null),
        _ => readMarker(request),
      },
    );
    await pumpCircleScreen(
      tester,
      const CircleThreadScreen(shareId: 's1'),
      api: api,
    );
  }

  testWidgets('your own post says "Reply…", not "Reply to <your handle>…"', (
    tester,
  ) async {
    await pumpThread(tester, isSelf: true);
    expect(find.text('Reply…'), findsOneWidget);
    expect(find.textContaining('Reply to'), findsNothing);
  });

  testWidgets("a friend's post names them in the placeholder", (tester) async {
    await pumpThread(tester, isSelf: false);
    expect(find.text('Reply to Hà…'), findsOneWidget);
    expect(find.text('Reply…'), findsNothing);
  });
}
