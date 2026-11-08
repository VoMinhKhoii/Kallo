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
  'auth.code.resent',
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
  'paywall.restoreAccountConflict',
  'paywall.restoreError',
  'paywall.restoreNothing',
  'settings.account.exportError',
  'settings.account.exportRateLimited',
  'settings.account.linkError',
  'settings.account.loadError',
  'settings.account.unlinkError',
];

/// The same, for toasts that carry the Undo action.
const _indirectUndoKeys = ['logging.mealRemoved', 'logging.pendingDiscarded'];

/// Files whose `showTopToast` call takes a variable. Their messages are the
/// keys listed above; a new file here means a new key to list.
const _filesWithIndirectToasts = {
  'account_section.dart',
  'auth_page.dart',
  'email_auth_screen.dart',
  'feature_lock.dart',
  'group_flows.dart',
  'meal_actions.dart',
  'moderation_flows.dart',
  'pure_relog_staging.dart',
  'subscription_section.dart',
  'top_toast.dart',
};

typedef _Toast = ({String key, String? actionKey});

final _keyPattern = RegExp(r"'([a-zA-Z]+(?:\.[a-zA-Z]+)+)'");

/// Every `showTopToast` call in `lib/`: the l10n keys the calls name, and the
/// files holding a call that names none.
({List<_Toast> toasts, Set<String> keylessFiles}) _scanCallSites() {
  final toasts = <_Toast>[];
  final keylessFiles = <String>{};
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
      final keys = _keyPattern.allMatches(parts[0]);
      if (keys.isEmpty) keylessFiles.add(file.uri.pathSegments.last);
      for (final match in keys) {
        toasts.add((key: match.group(1)!, actionKey: actionKey));
      }
      start = source.indexOf('showTopToast(', end);
    }
  }
  return (toasts: toasts, keylessFiles: keylessFiles);
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

  test('a toast taking a variable has its keys listed here', () {
    expect(_scanCallSites().keylessFiles, _filesWithIndirectToasts);
  });

  for (final locale in ['vi', 'en']) {
    testWidgets('every $locale toast fits one line on the narrowest phone', (
      tester,
    ) async {
      final strings =
          jsonDecode(File('assets/l10n/$locale.json').readAsStringSync())
              as Map<String, dynamic>;
      final toasts = {
        ..._scanCallSites().toasts,
        for (final key in _indirectKeys) (key: key, actionKey: null),
        for (final key in _indirectUndoKeys)
          (key: key, actionKey: 'logging.undo'),
      };
      expect(toasts.length, greaterThan(50), reason: 'call-site scan broke');

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
        if (tester.getSize(find.text(message)).height > kDashBodyLine * 1.5) {
          wrapped.add('${toast.key}: $message');
        }
      }
      expect(wrapped, isEmpty);
    });
  }
}
