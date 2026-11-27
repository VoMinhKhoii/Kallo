import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Guards against the two Riverpod 2.6.1 re-entrancy patterns that caused the
/// PR #627 production outage (builds 77–78), where `profileProvider` stayed
/// stuck in `AsyncLoading(value: null)` on every cold signed-in launch:
///
/// 1. Calling `unawaited(...)` (or synchronously reading an async provider)
///    inside a `ref.listen` / `ref.listenManual` callback on an async provider.
///    In Riverpod 2.6.1, `FutureHandlerProviderElementMixin.handleFuture` calls
///    `data(value)` (notifying listeners synchronously) BEFORE `done()`
///    (`_lastFutureSub?.call()`). A re-entrant `ref.read` on a dirty provider
///    rebuilds it inside `data()`, overwrites `_lastFutureSub` with the new
///    fetch's cancel closure, and the outer `done()` immediately cancels it.
///    Defer work from listeners via `scheduleMicrotask` (as
///    `GoRouterAuthRefresh.ping()` and `AccountLanguageSync._scheduleSync()` do).
///
/// 2. Declaring a `FutureProvider` as `async` when it watches
///    `signedInUserIdProvider` and returns `null` while signed out. An `async`
///    `return null` schedules a microtask `Future` that races with
///    `sessionProvider`'s initial emission; omitting `async` on the outer
///    callback lets Riverpod take its synchronous `FutureOr` branch.
String _stripComments(String source) => source
    .split('\n')
    .map((line) {
      if (line.trimLeft().startsWith('//')) return '';
      final marker = line.indexOf('//');
      if (marker == -1 || line.substring(0, marker).endsWith(':')) return line;
      return line.substring(0, marker);
    })
    .join('\n');

/// Extracts balanced `(...)` starting at [openParenIndex], or `null`.
String? _balancedParens(String text, int openParenIndex) {
  var depth = 0;
  for (var i = openParenIndex; i < text.length; i++) {
    final ch = text.codeUnitAt(i);
    if (ch == 40 /* ( */ ) {
      depth++;
    } else if (ch == 41 /* ) */ ) {
      depth--;
      if (depth == 0) return text.substring(openParenIndex, i + 1);
    }
  }
  return null;
}

void main() {
  final sources =
      Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.dart'))
          .toList()
        ..sort((a, b) => a.path.compareTo(b.path));

  group('Riverpod 2.6.1 re-entrancy guards', () {
    test('finds Flutter app sources to scan', () {
      expect(sources, isNotEmpty);
    });

    test(
      'no ref.listen / ref.listenManual callback invokes unawaited(...) synchronously',
      () {
        final pattern = RegExp(r'ref\.listen(?:Manual)?(?:<[^>]+>)?\s*\(');
        final offenders = <String>[];

        for (final file in sources) {
          final code = _stripComments(file.readAsStringSync());
          for (final match in pattern.allMatches(code)) {
            final openParen = code.indexOf('(', match.start);
            final call = _balancedParens(code, openParen);
            if (call == null) continue;
            if (RegExp(r'\bunawaited\s*\(').hasMatch(call)) {
              final line =
                  '\n'.allMatches(code.substring(0, match.start)).length + 1;
              offenders.add('${file.path}:$line');
            }
          }
        }

        expect(
          offenders,
          isEmpty,
          reason:
              'Never call unawaited(...) synchronously inside ref.listen / '
              'ref.listenManual: an async function runs synchronously up to its '
              'first await, so any ref.read inside it can re-entrantly flush a '
              'dirty FutureProvider inside Riverpod\'s handleFuture data() '
              'callback and let the outer done() cancel the new fetch. Schedule '
              'it with scheduleMicrotask instead.',
        );
      },
    );

    test(
      'no FutureProvider watching signedInUserIdProvider uses async with an early return null',
      () {
        final pattern = RegExp(
          r'FutureProvider(?:\.autoDispose)?(?:\.family)?(?:<[^>]+>)?\s*\(',
        );
        final offenders = <String>[];

        for (final file in sources) {
          final code = _stripComments(file.readAsStringSync());
          for (final match in pattern.allMatches(code)) {
            final openParen = code.indexOf('(', match.start);
            final call = _balancedParens(code, openParen);
            if (call == null) continue;
            final isAsyncOuter = RegExp(
              r'^\(\s*\([^)]*\)\s*async\s*\{',
            ).hasMatch(call);
            final watchesUserId = call.contains('signedInUserIdProvider');
            final returnsNull = RegExp(r'\breturn\s+null\s*;').hasMatch(call);
            if (isAsyncOuter && watchesUserId && returnsNull) {
              final line =
                  '\n'.allMatches(code.substring(0, match.start)).length + 1;
              offenders.add('${file.path}:$line');
            }
          }
        }

        expect(
          offenders,
          isEmpty,
          reason:
              'A FutureProvider watching signedInUserIdProvider that returns '
              'null when signed out must return synchronously (omit `async` on '
              'the outer callback and return FutureOr<T>) so it does not leave '
              'a microtask Future racing with sessionProvider\'s initial emit.',
        );
      },
    );
  });
}
