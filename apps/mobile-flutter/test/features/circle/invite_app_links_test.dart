// Guards the native half of https invite links (DEV-73). The web half,
// kallo.fit/.well-known/apple-app-site-association and assetlinks.json, is
// tested beside its routes in app/.well-known/; the Android path prefixes are
// held equal to the web's list there.

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
      contains(
        '<key>com.apple.developer.associated-domains</key>\n'
        '\t<array>\n'
        '\t\t<string>applinks:kallo.fit</string>',
      ),
    );
  });

  test('Android verifies kallo.fit invite links as App Links', () {
    final filter = RegExp(
      r'<intent-filter android:autoVerify="true">([\s\S]*?)</intent-filter>',
    ).firstMatch(manifest);
    expect(filter, isNotNull);
    final body = filter!.group(1)!;
    expect(body, contains('android.intent.category.BROWSABLE'));
    expect(
      body,
      contains('<data android:scheme="https" android:host="kallo.fit"/>'),
    );
    expect(body, contains('android:pathPrefix="/en/invite/"'));
  });

  test("Flutter's own deep linking is off on both platforms", () {
    // app_links listeners route every link; with Flutter's handler on too,
    // go_router also gets /en/invite/<slug>, matches nothing and shows the
    // error screen.
    expect(
      infoPlist,
      contains('<key>FlutterDeepLinkingEnabled</key>\n\t<false/>'),
    );
    expect(
      manifest,
      contains(
        'android:name="flutter_deeplinking_enabled"\n'
        '              android:value="false"',
      ),
    );
  });
}
