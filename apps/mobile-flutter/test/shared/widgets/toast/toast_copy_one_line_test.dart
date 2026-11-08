import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/toast/top_toast_pill.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

import '../../../app_fonts.dart';

/// The narrowest iPhone the app runs on (SE, 13 mini).
const _narrowestPhoneWidth = 375.0;

/// Messages that reach `showTopToast` through a wrapper or a variable, where
/// reading the call site cannot name the key.
const _indirectKeys = [
  'auth.errors.network',
  'auth.errors.rateLimited',
  'auth.errors.accountExists',
  'auth.errors.generic',
  'auth.errors.captcha',
  'errors.internal',
  'groups.feed.leaveError',
  'groups.info.added',
  'groups.info.addError',
  'groups.info.renameError',
  'groups.moderation.blocked',
  'groups.moderation.blockError',
  'groups.moderation.removed',
  'groups.moderation.reportError',
  'groups.moderation.reportSentBody',
  'groups.moderation.unblocked',
  'groups.moderation.unblockError',
  'logging.barcode.error.notCached',
  'logging.mealRemoved',
  'logging.pendingDiscarded',
  'paywall.restoreAccountConflict',
  'paywall.restoreError',
  'paywall.restoreNothing',
  'settings.account.exportError',
  'settings.account.exportRateLimited',
  'settings.account.linkError',
  'settings.account.loadError',
  'settings.account.unlinkError',
];

typedef _Toast = ({String key, String? actionKey});

final _keyPattern = RegExp(r"'([a-zA-Z]+(?:\.[a-zA-Z]+)+)'");

/// Every `showTopToast` call in `lib/`, by the l10n keys it names.
List<_Toast> _toastsAtCallSites() {
  final toasts = <_Toast>[];
  final sources = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'));
  for (final file in sources) {
    final source = file.readAsStringSync();
    var start = source.indexOf('showTopToast(');
    while (start != -1) {
      var end = start + 'showTopToast('.length;
      for (var depth = 1; depth > 0 && end < source.length; end++) {
        if (source[end] == '(') depth++;
        if (source[end] == ')') depth--;
      }
      final parts = source.substring(start, end).split('actionLabel:');
      final actionKey =
          parts.length > 1 ? _keyPattern.firstMatch(parts[1])?.group(1) : null;
      for (final match in _keyPattern.allMatches(parts[0])) {
        toasts.add((key: match.group(1)!, actionKey: actionKey));
      }
      start = source.indexOf('showTopToast(', end);
    }
  }
  return toasts;
}

String _resolve(Map<String, dynamic> strings, String key) {
  Object? node = strings;
  for (final part in key.split('.')) {
    node = (node as Map<String, dynamic>)[part];
  }
  if (node is Map) node = node['other'];
  expect(node, isA<String>(), reason: 'no string for $key');
  return (node! as String)
      .replaceAll('{name}', 'Minh Anh')
      .replaceAll('{max}', '10')
      .replaceAll('{count}', '12')
      .replaceAll('{date}', '')
      .trim();
}

void main() {
  setUpAll(loadAppFonts);

  for (final locale in ['vi', 'en']) {
    testWidgets('every $locale toast fits one line on the narrowest phone', (
      tester,
    ) async {
      final strings =
          jsonDecode(File('assets/l10n/$locale.json').readAsStringSync())
              as Map<String, dynamic>;
      final toasts = {
        ..._toastsAtCallSites(),
        for (final key in _indirectKeys) (key: key, actionKey: null),
      };
      expect(toasts.length, greaterThan(50), reason: 'call-site scan broke');

      final oneLine = kDashBodySize * kDashBodyLeading;
      final wrapped = <String>[];
      for (final toast in toasts) {
        final message = _resolve(strings, toast.key);
        final actionKey = toast.actionKey;
        await tester.pumpWidget(
          MaterialApp(
            home: Center(
              child: SizedBox(
                width: _narrowestPhoneWidth,
                child: TopToastPill(
                  message: message,
                  variant: TopToastVariant.error,
                  actionLabel:
                      actionKey == null ? null : _resolve(strings, actionKey),
                ),
              ),
            ),
          ),
        );
        if (tester.getSize(find.text(message)).height > oneLine * 1.5) {
          wrapped.add('${toast.key}: $message');
        }
      }
      expect(wrapped, isEmpty);
    });
  }
}
