// Guards the home-screen widget's wiring and its copies of the app's numbers.
//
// CI builds no iOS on a pull request, so nothing compiles the extension
// (ios/TodayWidget/) before TestFlight. Every piece here fails SILENTLY: a
// wrong App Group shows an empty widget, a drifted palette or dial constant
// draws a dial the app does not, a renamed JSON key reads as nothing. The
// contract is pinned here instead, against the sources the Swift ports.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/today_widget/data/today_widget_store.dart';
import 'package:kallo_mobile/features/today_widget/logic/today_widget_snapshot.dart';
import 'package:kallo_mobile/features/today_widget/logic/today_widget_sync.dart';

String read(String path) => File(path).readAsStringSync();

const widgetDir = 'ios/TodayWidget';
const appGroup = 'group.com.khoivo.nham';

/// `name: rgb(0xRRGGBB)` pairs inside one `static let <palette> = …(` block.
Map<String, String> swiftPalette(String swift, String palette) {
  final block =
      swift.split('static let $palette = WidgetTheme(')[1].split(')\n')[0];
  return {
    for (final m in RegExp(
      r'(\w+): rgb\(0x([0-9A-F]{6})\),\s*// (\w+)',
    ).allMatches(block))
      m.group(3)!: m.group(2)!,
  };
}

/// `field: const Color(0xFFRRGGBB)` inside one `final KalloPalette _<name>`.
Map<String, String> dartPalette(String dart, String palette) {
  final block = dart.split('final KalloPalette _$palette = ')[1].split(');')[0];
  return {
    for (final m in RegExp(
      r'(\w+): const Color\(0xFF([0-9A-F]{6})\)',
    ).allMatches(block))
      m.group(1)!: m.group(2)!,
  };
}

/// `static let <name>: Double = <value>` in a Swift file.
double swiftConst(String swift, String name) {
  final m =
      RegExp('static let $name: Double = ([0-9.\\-/ ]+)').firstMatch(swift)!;
  final expr = m.group(1)!.trim();
  if (expr.contains('/')) {
    final [a, b] = expr.split('/').map((s) => double.parse(s.trim())).toList();
    return a / b;
  }
  return double.parse(expr);
}

void main() {
  setUpAll(() => initializeDateFormatting('en', null));

  test('the widget draws the app palette, value for value', () {
    final swift = read('$widgetDir/WidgetTheme.swift');
    final dart = read('lib/theme/palette/kallo_palette_values.dart');
    for (final (swiftName, dartName) in [
      ('light', 'light'),
      ('aurora', 'aurora'),
    ]) {
      final ours = swiftPalette(swift, swiftName);
      final theirs = dartPalette(dart, dartName);
      expect(ours.keys, hasLength(9), reason: swiftName);
      for (final MapEntry(key: field, value: hex) in ours.entries) {
        expect(hex, theirs[field], reason: '$swiftName.$field');
      }
    }
    // Aurora's two lights are the brand hues.
    final colors = read('lib/theme/kallo_colors.dart');
    expect(colors, contains('brandApricot = Color(0xFFFFD2B0)'));
    expect(colors, contains('brandLilac = Color(0xFFDCC4FF)'));
    expect(swift, contains('rgb(0xFFD2B0).opacity(0.22)'));
    expect(swift, contains('rgb(0xDCC4FF).opacity(0.20)'));
  });

  test('the dial geometry is the app geometry', () {
    final swift = read('$widgetDir/Gauge/GaugeGeometry.swift');
    final dart = read('lib/shared/widgets/gauge/gauge_arc_geometry.dart');
    double dartConst(String name) => double.parse(
      RegExp('const double $name = ([0-9.\\-]+);').firstMatch(dart)!.group(1)!,
    );
    expect(swiftConst(swift, 'startAngle'), dartConst('kGaugeStartAngle'));
    expect(swiftConst(swift, 'endAngle'), dartConst('kGaugeEndAngle'));
    expect(swiftConst(swift, 'padAngle'), dartConst('kGaugePadAngle'));
    expect(swiftConst(swift, 'minSweep'), dartConst('kGaugeMinSweep'));
    expect(swiftConst(swift, 'bandRatio'), dartConst('_bandRatio'));
    expect(dart, contains('const double _cornerRatio = 4 / 9;'));
    expect(swiftConst(swift, 'cornerRatio'), closeTo(4 / 9, 1e-12));
    // The corner fit keeps the same 0.5° of breathing room, and the over cap
    // the same 8° floor.
    expect(
      read('lib/shared/widgets/gauge/rounded_sector_path.dart'),
      contains('(sweep - 0.5) / 2 * _deg'),
    );
    expect(swift, contains('(sweep - 0.5) / 2 * deg'));
    expect(dart, contains('(1 - 1 / progress).clamp(8 / span, 1.0)'));
    expect(swift, contains('min(max(1 - 1 / progress, 8 / span), 1)'));
  });

  test('the readout sizes are the web rules they port', () {
    final swift = read('$widgetDir/Gauge/GaugeReadout.swift');
    final size = read('../../lib/core/ui/gauge-figure-size.ts');
    final lines = read('../../components/shared/gauge/gauge-lines.ts');
    final layout = read('../../lib/core/ui/gauge-readout-layout.ts');
    final metrics = read('../../lib/core/ui/gauge-strip-metrics.ts');
    final dial = read('../../components/shared/gauge/macro-dial.tsx');
    final strip = read('../../lib/core/ui/gauge-strip-layout.ts');

    expect(size, contains('FIGURE_RATIO = { calorie: 0.39, macro: 0.44 }'));
    expect(swiftConst(swift, 'figureRatioCalorie'), 0.39);
    expect(swiftConst(swift, 'figureRatioMacro'), 0.44);
    expect(size, contains('FIGURE_MIN_PX = 11;'));
    expect(swiftConst(swift, 'figureMin'), 11);
    expect(size, contains('FIGURE_MAX_PX = 44;'));
    expect(swiftConst(swift, 'figureMax'), 44);
    // The fit test's bound; the widget measures its own words against it
    // rather than the web's worst-case string (owner decision in the PR).
    expect(
      size,
      contains(
        'LONG_UNIT_EM * gaugeUnitSize(radius) <= 0.9 * tipOpening(radius)',
      ),
    );
    expect(swift, contains('width <= 0.9 * tipOpening(r)'));
    for (final rule in [
      'clamp(Math.round(0.18 * radius), 11, 16)',
      'clamp(Math.round(0.25 * radius), 10, 14)',
      'Math.round(fontSize * 1.15)',
      '1.482 * radius',
    ]) {
      expect(size, contains(rule));
    }
    expect(swift, contains('clamp(jsRound(0.18 * r), 11, 16)'));
    expect(swift, contains('clamp(jsRound(0.25 * r), 10, 14)'));
    expect(swift, contains('jsRound(fontSize * 1.15)'));
    expect(swift, contains('1.482 * r'));
    expect(lines, contains('SHORT_LINE_LEADING = 4;'));
    expect(swift, contains('shortLineLeading: Double = 4'));
    expect(lines, contains("dial === 'calorie' ? Math.min(unit, meta) : meta"));
    expect(swift, contains('min(unit, metaSize(r))'));
    expect(layout, contains('GAUGE_LINE_GAP = 2;'));
    expect(swiftConst(swift, 'lineGap'), 2);
    expect(metrics, contains('LABEL_GAP = 2;'));
    expect(swiftConst(swift, 'labelGap'), 2);
    expect(metrics, contains('Math.round(gaugeMetaSize(radius) * 1.3)'));
    expect(swift, contains('jsRound(metaSize(r) * 1.3)'));
    expect(dial, contains('Math.max(12, Math.round(radius * 0.3))'));
    expect(swift, contains('max(12, jsRound(r * 0.3))'));
    expect(strip, contains('MACRO_MIN_RADIUS = 26;'));
    expect(
      read('$widgetDir/Gauge/DialRow.swift'),
      contains('macroRadius: Double = 26  // MACRO_MIN_RADIUS'),
    );
  });

  test('the JSON the app writes is the JSON the widget decodes', () {
    final swift = read('$widgetDir/TodaySnapshot.swift');
    List<String> fields(String struct) {
      final body = swift.split('struct $struct: Codable')[1].split('\n  }')[0];
      return [
        for (final m in RegExp(
          r'^\s+let (\w+):',
          multiLine: true,
        ).allMatches(body))
          m.group(1)!,
      ];
    }

    final top = swift.split('static let version')[1].split('func shown')[0];
    final topFields = [
      for (final m in RegExp(r'^  let (\w+):', multiLine: true).allMatches(top))
        m.group(1)!,
    ];
    final snapshot = todayWidgetSnapshot(
      date: '2026-11-04',
      locale: 'en',
      profile: const LoggingProfile(
        userId: 'u',
        calorieTarget: 1,
        proteinTargetG: 1,
        carbsTargetG: 1,
        fatTargetG: 1,
      ),
      meals: const [],
      tr: (key) => key,
    );
    expect(topFields.toSet(), snapshot.keys.toSet());
    // The signed-out card is decoded by the same struct.
    expect(
      todayWidgetSignedOut(
        date: '2026-11-04',
        locale: 'en',
        tr: (k) => k,
      ).keys.toSet(),
      topFields.toSet(),
    );
    expect(fields('Copy').toSet(), kTodayWidgetCopyKeys.keys.toSet());
    expect(fields('Macros').toSet(), (snapshot['target']! as Map).keys.toSet());
    expect(fields('Meal').toSet(), {'time', 'text', 'kcal'});
    expect(
      swift,
      contains('static let version = $kTodayWidgetSnapshotVersion'),
    );
  });

  test(
    'every copy key exists in both locales with the placeholders filled',
    () {
      const placeholders = {
        'leftOfTarget': ['{left}', '{target}'],
        'overTargetBy': ['{over}', '{target}'],
        'fraction': ['{logged}', '{target}'],
      };
      for (final locale in ['en', 'vi']) {
        final strings =
            jsonDecode(read('assets/l10n/$locale.json'))
                as Map<String, dynamic>;
        for (final MapEntry(key: field, value: path)
            in kTodayWidgetCopyKeys.entries) {
          Object? node = strings;
          for (final part in path.split('.')) {
            node = (node! as Map<String, dynamic>)[part];
          }
          expect(node, isA<String>(), reason: '$locale $path');
          for (final p in placeholders[field] ?? const <String>[]) {
            expect(node, contains(p), reason: '$locale $path');
          }
        }
      }
      // …and those are the names the widget fills.
      final format = read('$widgetDir/Gauge/CalorieDial.swift');
      for (final name in ['left', 'over', 'logged', 'target']) {
        expect(format, contains('"$name":'));
      }
    },
  );

  test('one App Group, one key, one kind, one tap link', () {
    for (final path in [
      'ios/Runner/Runner.entitlements',
      '$widgetDir/TodayWidget.entitlements',
    ]) {
      expect(
        read(path),
        contains(
          '<key>com.apple.security.application-groups</key>\n'
          '\t<array>\n'
          '\t\t<string>$appGroup</string>',
        ),
        reason: path,
      );
    }
    // The app writes through home_widget with these; the extension reads them.
    expect(kTodayWidgetAppGroup, appGroup);
    final snapshot = read('$widgetDir/TodaySnapshot.swift');
    expect(snapshot, contains('appGroup = "$kTodayWidgetAppGroup"'));
    expect(snapshot, contains('key = "$kTodayWidgetKey"'));
    expect(
      read('$widgetDir/TodayWidgetBundle.swift'),
      contains('kind = "$kTodayWidgetKind"'),
    );
    // home_widget stores into `UserDefaults(suiteName:)` — the suite the
    // extension opens — and reloads by kind; no channel of our own.
    expect(read('pubspec.yaml'), contains('home_widget: ^0.10.0'));
    expect(
      read('ios/Runner/AppDelegate.swift'),
      isNot(contains('TodayWidget')),
    );
    final link =
        RegExp(
          r'widgetURL\(URL\(string: "([^"]+)"\)\)',
        ).firstMatch(read('$widgetDir/TodayWidgetView.swift'))!.group(1)!;
    expect(isTodayWidgetLink(Uri.parse(link)), isTrue);
  });

  test(
    'the extension is a WidgetKit bundle at the app version, with its fonts',
    () {
      final plist = read('$widgetDir/Info.plist');
      expect(plist, contains('<string>com.apple.widgetkit-extension</string>'));
      expect(plist, contains('<string>\$(FLUTTER_BUILD_NAME)</string>'));
      expect(plist, contains('<string>\$(FLUTTER_BUILD_NUMBER)</string>'));
      expect(
        read('$widgetDir/TodayWidget.xcconfig'),
        contains('#include "../Flutter/Generated.xcconfig"'),
      );
      final pbxproj = read('ios/Runner.xcodeproj/project.pbxproj');
      for (final weight in ['Regular', 'Medium', 'SemiBold']) {
        final file = 'BeVietnamPro-$weight.ttf';
        expect(plist, contains('<string>$file</string>'));
        expect(File('assets/google_fonts/$file').existsSync(), isTrue);
        expect(pbxproj, contains('$file in Resources'));
      }
      expect(pbxproj, contains('path = ../../assets/google_fonts;'));
      for (final asset in ['protein', 'carbs', 'fat']) {
        expect(
          Directory('$widgetDir/Assets.xcassets/$asset.imageset').existsSync(),
          isTrue,
        );
      }
    },
  );

  test('Runner embeds the widget before Flutter thins the binary', () {
    final pbxproj = read('ios/Runner.xcodeproj/project.pbxproj');
    final runner =
        RegExp(
          r'/\* Runner \*/ = \{\s*isa = PBXNativeTarget;[^}]*buildPhases = \(([^)]*)\);',
        ).firstMatch(pbxproj)!;
    final phases = runner.group(1)!;
    expect(
      phases.indexOf('Embed Foundation Extensions'),
      lessThan(phases.indexOf('Thin Binary')),
    );
    expect(
      pbxproj,
      contains('TodayWidget.appex in Embed Foundation Extensions'),
    );

    final blocks =
        RegExp(
          r'buildSettings = \{([^}]*INFOPLIST_FILE = TodayWidget/Info\.plist;[^}]*)\};\s*name = (\w+);',
        ).allMatches(pbxproj).toList();
    expect(blocks.map((m) => m.group(2)).toSet(), {
      'Debug',
      'Profile',
      'Release',
    });
    for (final m in blocks) {
      final settings = m.group(1)!;
      expect(
        settings,
        contains('PRODUCT_BUNDLE_IDENTIFIER = com.khoivo.nham.TodayWidget;'),
      );
      expect(
        settings,
        contains(
          'CODE_SIGN_ENTITLEMENTS = TodayWidget/TodayWidget.entitlements;',
        ),
      );
    }
  });

  test('release signing names a profile for the widget too', () {
    expect(
      read('ios/ExportOptions.plist'),
      contains(
        '<key>com.khoivo.nham.TodayWidget</key>\n'
        '\t\t<string>match AppStore com.khoivo.nham.TodayWidget</string>',
      ),
    );
    expect(read('ios/fastlane/Matchfile'), contains('.TodayWidget"'));
    final fastfile = read('ios/fastlane/Fastfile');
    expect(fastfile, contains('"TodayWidget" => WIDGET_ID'));
    expect(fastfile, contains('[APP_ID, NSE_ID, WIDGET_ID]'));
  });
}
