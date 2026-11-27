import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/scan/camera/teardown.dart';

/// The wait a new scan screen makes for the last one's camera release.
void main() {
  setUp(ScanCameraReleases.reset);

  testWidgets('a hung release costs the wait once, not on every screen', (
    tester,
  ) async {
    ScanCameraReleases.track(Completer<void>().future); // never completes

    var first = false;
    unawaited(ScanCameraReleases.settled.then((_) => first = true));
    await tester.pump(const Duration(seconds: 1));
    expect(first, isFalse, reason: 'still within the cap');
    await tester.pump(const Duration(seconds: 1));
    expect(first, isTrue, reason: 'the cap gives up on it');

    var second = false;
    unawaited(ScanCameraReleases.settled.then((_) => second = true));
    await tester.pump();
    expect(second, isTrue, reason: 'the next screen does not wait again');
  });

  testWidgets('a hung release is dropped even when another was tracked '
      'during the wait', (tester) async {
    ScanCameraReleases.track(Completer<void>().future); // never completes

    var waited = false;
    unawaited(ScanCameraReleases.settled.then((_) => waited = true));
    await tester.pump(const Duration(seconds: 1));
    // A screen that opened during the wait closes before the cap.
    ScanCameraReleases.track(Future<void>.value());
    await tester.pump(const Duration(seconds: 1));
    expect(waited, isTrue);

    var next = false;
    unawaited(ScanCameraReleases.settled.then((_) => next = true));
    await tester.pump();
    expect(next, isTrue, reason: 'the hung release is not waited for again');
  });

  testWidgets('a release that finishes is waited for, then forgotten', (
    tester,
  ) async {
    final release = Completer<void>();
    ScanCameraReleases.track(release.future);

    var settled = false;
    unawaited(ScanCameraReleases.settled.then((_) => settled = true));
    await tester.pump(const Duration(milliseconds: 100));
    expect(settled, isFalse);

    release.complete();
    await tester.pump();
    expect(settled, isTrue);
  });
}
