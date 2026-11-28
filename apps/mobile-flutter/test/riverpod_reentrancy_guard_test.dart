/// Static guards for the two direct code shapes behind the PR #627 production
/// outage (builds 77–78), where `profileProvider` stayed stuck in
/// `AsyncLoading(value: null)` on every cold signed-in launch:
///
/// 1. Calling `unawaited(...)` or directly reading a watched async provider
///    (`profileProvider`, `sessionProvider`, `onboardingDraftProvider`) inside a
///    `ref.listen` / `ref.listenManual` callback. In Riverpod 2.6.1,
///    `FutureHandlerProviderElementMixin.handleFuture` notifies listeners
///    (`data(value)`) BEFORE calling `done()` (`_lastFutureSub?.call()`). A
///    re-entrant `ref.read` on a dirty provider rebuilds it inside `data()`,
///    overwrites `_lastFutureSub` with the new fetch's cancel closure, and the
///    outer `done()` immediately cancels it. Defer work from listeners via
///    `scheduleMicrotask` (as `GoRouterAuthRefresh.ping()` and
///    `AccountLanguageSync._scheduleSync()` do).
///    Note: static scanning cannot trace arbitrary indirect helper calls, so
///    `cold_signed_in_boot_test.dart` and `account_language_test.dart` exercise
///    the real cold-start graph at runtime alongside this guard.
///
/// 2. Declaring a `FutureProvider` as `async` when it watches
///    `signedInUserIdProvider` and returns `null` while signed out. An `async`
///    `return null` schedules a microtask `Future` that races with
///    `sessionProvider`'s initial emission; omitting `async` on the outer
///    callback lets Riverpod take its synchronous `FutureOr` branch.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Strips `//` and `/* ... */` comments while replacing string literal bodies
/// with spaces (tracking `${...}` interpolation nesting inside non-raw strings)
/// so parentheses, quotes, or `//` inside strings never confuse scanning.
String _stripCommentsAndStrings(String source) {
  final out = StringBuffer();
  final n = source.length;
  var i = 0;

  void scanCode({required bool stopAtClosingBrace}) {
    var braceDepth = 0;
    while (i < n) {
      final c = source.codeUnitAt(i);
      final next = i + 1 < n ? source.codeUnitAt(i + 1) : 0;
      if (stopAtClosingBrace) {
        if (c == 123 /* { */ ) {
          braceDepth++;
        } else if (c == 125 /* } */ ) {
          if (braceDepth == 0) {
            i++;
            return;
          }
          braceDepth--;
        }
      }
      // Line comment.
      if (c == 47 /* / */ && next == 47 /* / */ ) {
        while (i < n && source.codeUnitAt(i) != 10 /* \n */ ) {
          i++;
        }
        continue;
      }
      // Block comment.
      if (c == 47 /* / */ && next == 42 /* * */ ) {
        i += 2;
        while (i + 1 < n &&
            !(source.codeUnitAt(i) == 42 && source.codeUnitAt(i + 1) == 47)) {
          if (source.codeUnitAt(i) == 10) out.write('\n');
          i++;
        }
        i += 2;
        continue;
      }
      // Raw string r'...' / r"..." or normal/triple-quoted string.
      final isRaw =
          c == 114 /* r */ && (next == 39 /* ' */ || next == 34 /* " */ );
      if (isRaw || c == 39 || c == 34) {
        if (isRaw) i++;
        final quote = source.codeUnitAt(i);
        final triple =
            i + 2 < n &&
            source.codeUnitAt(i + 1) == quote &&
            source.codeUnitAt(i + 2) == quote;
        i += triple ? 3 : 1;
        out.write(' ');
        while (i < n) {
          final sc = source.codeUnitAt(i);
          if (sc == 10) out.write('\n');
          if (!isRaw && sc == 92 /* \ */ ) {
            i += 2;
            continue;
          }
          if (!isRaw &&
              sc == 36 /* $ */ &&
              i + 1 < n &&
              source.codeUnitAt(i + 1) == 123 /* { */ ) {
            i += 2;
            out.write(' ');
            scanCode(stopAtClosingBrace: true);
            out.write(' ');
            continue;
          }
          if (triple) {
            if (i + 2 < n &&
                source.codeUnitAt(i) == quote &&
                source.codeUnitAt(i + 1) == quote &&
                source.codeUnitAt(i + 2) == quote) {
              i += 3;
              break;
            }
          } else if (sc == quote) {
            i++;
            break;
          }
          i++;
        }
        continue;
      }
      out.writeCharCode(c);
      i++;
    }
  }

  scanCode(stopAtClosingBrace: false);
  return out.toString();
}

/// Skips optional whitespace and balanced generic type arguments `<...>` (even
/// nested, e.g. `<AsyncValue<ProfileRow?>>`), returning the index of the next
/// `(` if immediately present, or `-1`.
int _openParenAfterOptionalGenerics(String text, int start) {
  var i = start;
  while (i < text.length && _isSpace(text.codeUnitAt(i))) {
    i++;
  }
  if (i < text.length && text.codeUnitAt(i) == 60 /* < */ ) {
    var depth = 0;
    while (i < text.length) {
      final ch = text.codeUnitAt(i);
      if (ch == 60 /* < */ ) {
        depth++;
      } else if (ch == 62 /* > */ ) {
        depth--;
        if (depth == 0) {
          i++;
          break;
        }
      }
      i++;
    }
    if (depth != 0) return -1;
    while (i < text.length && _isSpace(text.codeUnitAt(i))) {
      i++;
    }
  }
  return i < text.length && text.codeUnitAt(i) == 40 /* ( */ ? i : -1;
}

bool _isSpace(int cu) => cu == 32 || cu == 9 || cu == 10 || cu == 13;

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
      'no ref.listen / ref.listenManual callback invokes unawaited(...) or reads core async providers synchronously',
      () {
        final pattern = RegExp(r'ref\.listen(?:Manual)?\b');
        final forbidden = RegExp(
          r'\bunawaited\s*\(|ref\.read\s*\(\s*(?:profileProvider|sessionProvider|onboardingDraftProvider)\b',
        );
        final offenders = <String>[];

        for (final file in sources) {
          final code = _stripCommentsAndStrings(file.readAsStringSync());
          for (final match in pattern.allMatches(code)) {
            final openParen = _openParenAfterOptionalGenerics(code, match.end);
            if (openParen == -1) continue;
            final call = _balancedParens(code, openParen);
            if (call == null) continue;
            if (forbidden.hasMatch(call)) {
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
              'Never call unawaited(...) or ref.read(...) on core async '
              'providers synchronously inside ref.listen / ref.listenManual: '
              'a re-entrant flush inside Riverpod\'s handleFuture data() '
              'callback lets the outer done() cancel the new fetch. Schedule '
              'the work with scheduleMicrotask instead.',
        );
      },
    );

    test(
      'no FutureProvider watching signedInUserIdProvider uses async with an early return null',
      () {
        final pattern = RegExp(
          r'FutureProvider(?:\.autoDispose)?(?:\.family)?\b',
        );
        final offenders = <String>[];

        for (final file in sources) {
          final code = _stripCommentsAndStrings(file.readAsStringSync());
          for (final match in pattern.allMatches(code)) {
            final openParen = _openParenAfterOptionalGenerics(code, match.end);
            if (openParen == -1) continue;
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
