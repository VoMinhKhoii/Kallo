import 'package:flutter/foundation.dart';

/// [teardown], reported instead of thrown when it fails. A camera's teardown
/// is awaited by every later open, release and mode switch; a rejected one
/// would fail all of them until the screen closed, and the switch that hit it
/// would leave its veil down over a black screen.
Future<void> reportingFailure(Future<void> teardown) => teardown.catchError(
  (Object error, StackTrace stack) => FlutterError.reportError(
    FlutterErrorDetails(exception: error, stack: stack, library: 'scan'),
  ),
);

/// The cameras a closed scan screen is still letting go of. Process-wide, like
/// what they share on Android: the CameraX provider and the scanner plugin's
/// platform instance. A scan screen opened right after one closed starts its
/// first camera only once these have settled; each screen's own queue cannot
/// see the screen before it.
abstract final class ScanCameraReleases {
  /// Each release still in flight, dropped when it finishes. Held one by
  /// one rather than chained, so the cap in [settled] can give up on exactly
  /// the releases it waited for and nothing newer.
  static final Set<Future<void>> _pending = {};

  /// Capped: a release that never finishes (a plugin that never answers)
  /// must not leave every later scan screen without a camera. It costs the
  /// wait once: once it times out, those releases are no longer waited for.
  /// With nothing in flight, there is no hop through the event loop.
  static Future<void> get settled async {
    if (_pending.isEmpty) return;
    final waited = Set.of(_pending);
    // `.then`, not the wait itself: `Future.wait` is a Future<List>, and the
    // timeout answers with void.
    await Future.wait(waited)
        .then((_) {})
        .timeout(
          const Duration(seconds: 2),
          onTimeout: () {
            _pending.removeAll(waited);
          },
        );
  }

  /// A test's releases run in its own fake clock and never finish once it
  /// ends; the next test starts with none.
  @visibleForTesting
  static void reset() => _pending.clear();

  static void track(Future<void> release) {
    late final Future<void> tracked;
    tracked = reportingFailure(
      release,
    ).whenComplete(() => _pending.remove(tracked));
    _pending.add(tracked);
  }
}
