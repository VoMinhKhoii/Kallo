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
  /// Null while nothing is being released: a screen with nothing to wait
  /// for starts its camera without a hop through the event loop.
  static Future<void>? _pending;

  /// Capped: a release that never finishes (a plugin that never answers)
  /// must not leave every later scan screen without a camera.
  static Future<void> get settled async {
    final pending = _pending;
    if (pending == null) return;
    await pending.timeout(const Duration(seconds: 2), onTimeout: () {});
  }

  /// A test's releases run in its own fake clock and never finish once it
  /// ends; the next test starts with none.
  @visibleForTesting
  static void reset() => _pending = null;

  static void track(Future<void> release) {
    final before = _pending;
    late final Future<void> pending;
    // `.then`, not the wait itself: `Future.wait` is a Future<List>, and the
    // timeout in [settled] answers with void.
    pending = Future.wait([
      if (before != null) before,
      reportingFailure(release),
    ]).then((_) {
      // The last release settled: later screens need not wait at all.
      if (identical(_pending, pending)) _pending = null;
    });
    _pending = pending;
  }
}
