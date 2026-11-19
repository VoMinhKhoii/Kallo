import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// One clock for freshness decisions, overridable by lifecycle tests.
final queryNowProvider = Provider<DateTime Function()>((ref) => DateTime.now);

/// Retain a successful request until [duration] elapses. The returned release
/// also lets a terminal access error evict the retained value immediately.
void Function() retainQuery(Ref<Object?> ref, Duration duration) {
  final link = ref.keepAlive();
  final timer = Timer(duration, link.close);
  ref.onDispose(timer.cancel);
  return () {
    timer.cancel();
    link.close();
  };
}
