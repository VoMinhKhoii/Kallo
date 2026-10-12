// Guards the communication-notification wiring: the sender's avatar where the
// app icon was, the Kallo icon badged in the corner. Every piece fails SILENTLY
// on a device — drop any one and iOS just shows the plain banner again, with
// no error anywhere — so the contract is pinned here instead of rediscovered on
// a phone. The extension itself is ios/NotificationService/.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  String read(String path) => File(path).readAsStringSync();

  final pbxproj = read('ios/Runner.xcodeproj/project.pbxproj');

  test('the app holds the Communication Notifications entitlement', () {
    expect(
      read('ios/Runner/Runner.entitlements'),
      contains(
        '<key>com.apple.developer.usernotifications.communication</key>\n'
        '\t<true/>',
      ),
    );
  });

  test('the app declares INSendMessageIntent as a user activity', () {
    // Without it `UNNotificationContent.updating(from:)` succeeds and iOS
    // still renders the app icon.
    expect(
      read('ios/Runner/Info.plist'),
      contains(
        '<key>NSUserActivityTypes</key>\n'
        '\t<array>\n'
        '\t\t<string>INSendMessageIntent</string>',
      ),
    );
  });

  test(
    'the extension is a notification service bundled at the app version',
    () {
      final plist = read('ios/NotificationService/Info.plist');
      expect(
        plist,
        contains('<string>com.apple.usernotifications.service</string>'),
      );
      expect(
        plist,
        contains(
          '<string>\$(PRODUCT_MODULE_NAME).NotificationService</string>',
        ),
      );
      // App Store Connect rejects an extension whose version differs from its
      // parent's; both read the values `flutter build` writes.
      expect(plist, contains('<string>\$(FLUTTER_BUILD_NAME)</string>'));
      expect(plist, contains('<string>\$(FLUTTER_BUILD_NUMBER)</string>'));
      expect(
        read('ios/NotificationService/NotificationService.xcconfig'),
        contains('#include "../Flutter/Generated.xcconfig"'),
      );
    },
  );

  test('Runner embeds the extension before Flutter thins the binary', () {
    final runner = RegExp(
      r'/\* Runner \*/ = \{\s*isa = PBXNativeTarget;[^}]*buildPhases = \(([^)]*)\);',
    ).firstMatch(pbxproj);
    expect(runner, isNotNull);
    final phases = runner!.group(1)!;
    final embed = phases.indexOf('Embed Foundation Extensions');
    final thin = phases.indexOf('Thin Binary');
    expect(
      embed,
      isNonNegative,
      reason: 'the appex is never copied into the app',
    );
    // After it, Xcode reports "Cycle inside Runner" and refuses to build.
    expect(embed, lessThan(thin));
    expect(
      pbxproj,
      contains('NotificationService.appex in Embed Foundation Extensions'),
    );
  });

  test('every extension configuration carries its own bundle id', () {
    final blocks =
        RegExp(
          r'buildSettings = \{([^}]*INFOPLIST_FILE = NotificationService/Info\.plist;[^}]*)\};\s*name = (\w+);',
        ).allMatches(pbxproj).toList();
    expect(blocks.map((m) => m.group(2)).toSet(), {
      'Debug',
      'Profile',
      'Release',
    });
    for (final m in blocks) {
      expect(
        m.group(1),
        contains(
          'PRODUCT_BUNDLE_IDENTIFIER = com.khoivo.nham.NotificationService;',
        ),
      );
    }
  });

  test('release signing names a profile for the extension too', () {
    // Manual signing: an embedded bundle with no profile fails export.
    expect(
      read('ios/ExportOptions.plist'),
      contains(
        '<key>com.khoivo.nham.NotificationService</key>\n'
        '\t\t<string>match AppStore com.khoivo.nham.NotificationService</string>',
      ),
    );
    expect(read('ios/fastlane/Matchfile'), contains('.NotificationService"'));
    expect(
      read('ios/fastlane/Fastfile'),
      contains('"NotificationService" => NSE_ID'),
    );
  });

  test('the extension draws the same initials-disc tints as the app', () {
    // A photo-less friend gets a disc on the lock screen; it should be the
    // colour they are in the app. Dart `Color(0xAARRGGBB)` ↔ Swift
    // `rgba(0xRRGGBB, 0xAA)`, in order.
    final dart =
        RegExp(r'Color\(0x([0-9A-F]{2})([0-9A-F]{6})\)')
            .allMatches(
              read(
                'lib/shared/widgets/avatar/profile_avatar.dart',
              ).split('];')[0],
            )
            .map((m) => '${m.group(2)}/${m.group(1)}')
            .toList();
    final swiftTints =
        read(
          'ios/NotificationService/SenderAvatar.swift',
        ).split('private static let tints')[1].split('\n  ]')[0];
    final swift =
        RegExp(r'rgba\(0x([0-9A-F]{6}), 0x([0-9A-F]{2})\)')
            .allMatches(swiftTints)
            .map((m) => '${m.group(1)}/${m.group(2)}')
            .toList();
    expect(dart, hasLength(6));
    expect(swift, dart);
  });
}
