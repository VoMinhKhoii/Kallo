// Guards the APNs signing contract under MANUAL signing (see
// ios/fastlane/Fastfile): the entitlement value is embedded verbatim and
// validated against the provisioning profile, so a hardcoded
// `aps-environment = development` fails every App Store / TestFlight export
// (the App Store profile carries `production`). The value must therefore come
// from a per-configuration build setting.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final entitlements =
      File('ios/Runner/Runner.entitlements').readAsStringSync();
  final pbxproj =
      File('ios/Runner.xcodeproj/project.pbxproj').readAsStringSync();

  test('aps-environment is driven by the APS_ENVIRONMENT build setting', () {
    expect(
      entitlements,
      contains(
        '<key>aps-environment</key>\n\t<string>\$(APS_ENVIRONMENT)</string>',
      ),
      reason:
          'never hardcode development/production — manual signing embeds '
          'the literal and the App Store profile rejects "development"',
    );
  });

  test('every Runner configuration defines APS_ENVIRONMENT', () {
    // Each Runner-target build configuration block references the
    // entitlements file; the same block must pin the environment.
    final blocks =
        RegExp(
          r'buildSettings = \{([^}]*CODE_SIGN_ENTITLEMENTS = Runner/Runner\.entitlements;[^}]*)\};\s*name = (\w+);',
        ).allMatches(pbxproj).toList();
    expect(blocks.map((m) => m.group(2)).toSet(), {
      'Debug',
      'Profile',
      'Release',
    });

    for (final m in blocks) {
      final settings = m.group(1)!;
      final name = m.group(2)!;
      final expected = name == 'Release' ? 'production' : 'development';
      expect(
        settings,
        contains('APS_ENVIRONMENT = $expected;'),
        reason: '$name must build against the $expected APNs environment',
      );
    }
  });
}
