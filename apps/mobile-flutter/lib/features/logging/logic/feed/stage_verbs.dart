import 'dart:ui' show Locale;

import 'package:easy_localization/easy_localization.dart';

/// How many numbered `verbs.<stage>N` keys to look for. A stage may carry
/// fewer — probing stops at the first missing key — but not more without
/// raising this.
const int _maxVerbsPerStage = 3;

/// The cycling action verbs for each pipeline stage, resolved out of the
/// locale files.
///
/// Cached per (locale, stage) because the ticker asks on every build and
/// `easy_localization` logs a warning for each missing key: an un-cached probe
/// of a stage with two verbs would spam the log every rebuild, forever.
class StageVerbs {
  final Map<String, List<String>> _cache = {};

  /// The word every verb in this locale opens with, which the ticker holds
  /// still while the rest of the line flips.
  ///
  /// Vietnamese builds each verb as `Đang <verb>`, so re-animating that opener
  /// on every rotation was wasted motion. Empty in English, which has no
  /// shared opener.
  String get prefix {
    const key = 'logging.streaming.verbs.prefix';
    final value = key.tr();
    return value == key ? '' : value;
  }

  /// The verbs for [stage], in the order they cycle. Empty when the locale
  /// carries none, which the caller answers with the stage's flat label.
  List<String> forStage(String stage, Locale locale) {
    return _cache.putIfAbsent('$locale|$stage', () {
      final found = <String>[];
      for (var i = 1; i <= _maxVerbsPerStage; i++) {
        final key = 'logging.streaming.verbs.$stage$i';
        final value = key.tr();
        // `tr` echoes the key back when it is missing.
        if (value == key) break;
        found.add(value);
      }
      return found;
    });
  }
}
