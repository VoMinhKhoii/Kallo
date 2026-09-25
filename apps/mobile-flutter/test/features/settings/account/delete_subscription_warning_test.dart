import 'dart:convert';
import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/settings/logic/delete_subscription_warning.dart';
import 'package:kallo_mobile/features/settings/screens/account_delete_screen.dart';

import '../../onboarding/onboarding_test_support.dart';
import '../settings_test_support.dart';

/// App Review 2.3.10: the iOS build may not name another platform's store.
/// The delete-account footnote used to list "App Store, Google Play, or the
/// billing portal … on the web" everywhere; iOS now gets App-Store-only copy.

const _generalKey = 'settings.account.deleteSubscriptionWarning';
const _iosKey = 'settings.account.deleteSubscriptionWarningIos';

String _lookup(String locale, String key) {
  final json =
      jsonDecode(File('assets/l10n/$locale.json').readAsStringSync())
          as Map<String, dynamic>;
  Object? node = json;
  for (final part in key.split('.')) {
    node = (node as Map<String, dynamic>)[part];
  }
  return node! as String;
}

void main() {
  group('deleteSubscriptionWarningKey', () {
    test('iOS gets the App-Store-only copy', () {
      expect(deleteSubscriptionWarningKey(TargetPlatform.iOS), _iosKey);
    });

    test('every other platform keeps the general copy', () {
      for (final platform in TargetPlatform.values) {
        if (platform == TargetPlatform.iOS) continue;
        expect(deleteSubscriptionWarningKey(platform), _generalKey);
      }
    });
  });

  group('iOS copy', () {
    for (final locale in const ['en', 'vi']) {
      test('$locale names only the App Store', () {
        final copy = _lookup(locale, _iosKey);
        expect(copy, contains('App Store'));
        expect(copy, isNot(contains('Google')));
        expect(copy.toLowerCase(), isNot(contains('play')));
        expect(copy.toLowerCase(), isNot(contains('web')));
      });
    }
  });

  group('AccountDeleteScreen', () {
    setUpAll(() => initOnboardingTest(fonts: false));

    testWidgets(
      'renders the copy for the running platform',
      (tester) async {
        await pumpSettingsPage(tester, const AccountDeleteScreen());
        final isIos = defaultTargetPlatform == TargetPlatform.iOS;

        expect(find.text(tr(isIos ? _iosKey : _generalKey)), findsOneWidget);
        expect(find.text(tr(isIos ? _generalKey : _iosKey)), findsNothing);
        if (isIos) {
          expect(find.textContaining('Google Play'), findsNothing);
        }
      },
      variant: const TargetPlatformVariant({
        TargetPlatform.iOS,
        TargetPlatform.android,
      }),
    );
  });
}
