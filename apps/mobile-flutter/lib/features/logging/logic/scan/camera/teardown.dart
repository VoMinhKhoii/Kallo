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
