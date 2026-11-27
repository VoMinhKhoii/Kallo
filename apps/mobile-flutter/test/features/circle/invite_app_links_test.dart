// Guards the native half of https invite links (DEV-73). The web half,
// kallo.fit/.well-known/apple-app-site-association and assetlinks.json, is
// tested in lib/app-links/__tests__/, which also owns the contract that the
// manifest's pathPrefix list equals the web's INVITE_PATH_PREFIXES.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final entitlements =
      File('ios/Runner/Runner.entitlements').readAsStringSync();
  final infoPlist = File('ios/Runner/Info.plist').readAsStringSync();
  final manifest =
      File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

  test('iOS claims kallo.fit as a Universal Link domain', () {
    expect(
      entitlements,
      matches(
        RegExp(
          r'<key>com\.apple\.developer\.associated-domains</key>\s*<array>\s*'
          r'<string>applinks:kallo\.fit</string>',
        ),
      ),
    );
  });

  test('Android verifies kallo.fit links as App Links', () {
    final filter = RegExp(
      r'<intent-filter android:autoVerify="true">([\s\S]*?)</intent-filter>',
    ).firstMatch(manifest);
    expect(filter, isNotNull);
    final body = filter!.group(1)!;
    expect(body, contains('android.intent.category.BROWSABLE'));
    expect(
      body,
      matches(RegExp(r'android:scheme="https"\s+android:host="kallo\.fit"')),
    );
  });

  test("Flutter's own deep linking is off on both platforms", () {
    // app_links listeners route every link; with Flutter's handler on too,
    // go_router also gets /en/invite/<slug>, matches nothing and shows the
    // error screen.
    expect(
      infoPlist,
      matches(RegExp(r'<key>FlutterDeepLinkingEnabled</key>\s*<false/>')),
    );
    expect(
      manifest,
      matches(
        RegExp(
          r'android:name="flutter_deeplinking_enabled"\s+'
          r'android:value="false"',
        ),
      ),
    );
  });
}
