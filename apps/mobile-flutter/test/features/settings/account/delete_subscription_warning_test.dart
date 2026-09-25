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
/// billing portal … on the web" everywhere. iOS now gets App Store copy for
/// an App Store subscription and store-neutral copy for any other store.

const _generalKey = 'settings.account.deleteSubscriptionWarning';
const _iosKey = 'settings.account.deleteSubscriptionWarningIos';
const _iosOtherStoreKey =
    'settings.account.deleteSubscriptionWarningIosOtherStore';

void _expectNoOtherStore(String copy) {
  expect(copy, isNot(contains('Google')));
  expect(copy.toLowerCase(), isNot(contains('play')));
  expect(copy.toLowerCase(), isNot(contains('web')));
}

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
    test('iOS with no managing store gets the App Store copy', () {
      expect(
        deleteSubscriptionWarningKey(platform: TargetPlatform.iOS),
        _iosKey,
      );
    });

    test('iOS with an App Store subscription gets the App Store copy', () {
      for (final store in const ['app_store', 'mac_app_store']) {
        expect(
          deleteSubscriptionWarningKey(
            platform: TargetPlatform.iOS,
            managementStore: store,
          ),
          _iosKey,
        );
      }
    });

    // A cross-store subscriber (bought on Android or the web, signed in on
    // iOS) must not be told to cancel in the App Store: deleting would leave
    // their real subscription charging.
    test('iOS with a subscription from another store gets neutral copy', () {
      for (final store in const ['play_store', 'paddle', 'stripe']) {
        expect(
          deleteSubscriptionWarningKey(
            platform: TargetPlatform.iOS,
            managementStore: store,
          ),
          _iosOtherStoreKey,
        );
      }
    });

    test('every other platform keeps the general copy', () {
      for (final platform in TargetPlatform.values) {
        if (platform == TargetPlatform.iOS) continue;
        for (final store in const [null, 'app_store', 'play_store']) {
          expect(
            deleteSubscriptionWarningKey(
              platform: platform,
              managementStore: store,
            ),
            _generalKey,
          );
        }
      }
    });
  });

  group('iOS copy', () {
    for (final locale in const ['en', 'vi']) {
      test('$locale App Store copy names only the App Store', () {
        final copy = _lookup(locale, _iosKey);
        expect(copy, contains('App Store'));
        _expectNoOtherStore(copy);
      });

      test('$locale other-store copy names no store at all', () {
        final copy = _lookup(locale, _iosOtherStoreKey);
        expect(copy, isNot(contains('App Store')));
        _expectNoOtherStore(copy);
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
