// Guards the Android home-screen widget's wiring and its copies of the app's
// numbers.
//
// CI builds no Android on a pull request, so nothing compiles
// android/.../todaywidget/ before a Play upload. Every piece here fails
// SILENTLY: a wrong prefs file or key shows an empty widget, a drifted palette
// or dial constant draws a dial the app does not, a renamed JSON key reads as
// nothing, a renamed provider class leaves the widget stale forever. The
// contract is pinned here instead, against the sources the Kotlin ports (the
// same sources `test/ios/today_widget_test.dart` holds the Swift to).

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/today_widget/data/today_widget_store.dart';
import 'package:kallo_mobile/features/today_widget/logic/today_widget_link.dart';
import 'package:kallo_mobile/features/today_widget/logic/today_widget_snapshot.dart';

String read(String path) => File(path).readAsStringSync();

const widgetDir = 'android/app/src/main/kotlin/fit/kallo/app/todaywidget';
const manifest = 'android/app/src/main/AndroidManifest.xml';

/// `name = rgb(0xRRGGBB), // field` pairs inside one `val <palette> = …(` block.
Map<String, String> kotlinPalette(String kotlin, String palette) {
  final block =
      kotlin.split('val $palette = WidgetTheme(')[1].split('\n    )\n')[0];
  return {
    for (final m in RegExp(
      r'(\w+) = rgb\(0x([0-9A-F]{6})\), // (\w+)',
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

/// `const val <NAME> = <value>` in a Kotlin file.
double kotlinConst(String kotlin, String name) {
  // A number, or `a / b`; never the `//` comment after it.
  final m =
      RegExp(
        'const val $name = (-?[0-9.]+(?: / [0-9.]+)?)',
      ).firstMatch(kotlin)!;
  final expr = m.group(1)!.trim();
  if (expr.contains('/')) {
    final [a, b] = expr.split('/').map((s) => double.parse(s.trim())).toList();
    return a / b;
  }
  return double.parse(expr);
}

void main() {
  test('the widget draws the app palette, value for value', () {
    final kotlin = read('$widgetDir/WidgetTheme.kt');
    final dart = read('lib/theme/palette/kallo_palette_values.dart');
    for (final palette in ['light', 'aurora']) {
      final ours = kotlinPalette(kotlin, palette);
      final theirs = dartPalette(dart, palette);
      expect(ours.keys, hasLength(9), reason: palette);
      for (final MapEntry(key: field, value: hex) in ours.entries) {
        expect(hex, theirs[field], reason: '$palette.$field');
      }
    }
    final colors = read('lib/theme/kallo_colors.dart');
    expect(colors, contains('brandApricot = Color(0xFFFFD2B0)'));
    expect(colors, contains('brandLilac = Color(0xFFDCC4FF)'));
    expect(kotlin, contains('alpha(rgb(0xFFD2B0), 0.22)'));
    expect(kotlin, contains('alpha(rgb(0xDCC4FF), 0.20)'));
    // The same hours as the iOS widget.
    final swift = read('ios/TodayWidget/WidgetTheme.swift');
    expect(swift, contains('static let lightFrom = 6'));
    expect(swift, contains('static let lightUntil = 18'));
    expect(kotlinConst(kotlin, 'LIGHT_FROM'), 6);
    expect(kotlinConst(kotlin, 'LIGHT_UNTIL'), 18);
  });

  test('the dial geometry is the app geometry', () {
    final kotlin = read('$widgetDir/gauge/GaugeGeometry.kt');
    final dart = read('lib/shared/widgets/gauge/gauge_arc_geometry.dart');
    double dartConst(String name) => double.parse(
      RegExp('const double $name = ([0-9.\\-]+);').firstMatch(dart)!.group(1)!,
    );
    expect(kotlinConst(kotlin, 'START_ANGLE'), dartConst('kGaugeStartAngle'));
    expect(kotlinConst(kotlin, 'END_ANGLE'), dartConst('kGaugeEndAngle'));
    expect(kotlinConst(kotlin, 'PAD_ANGLE'), dartConst('kGaugePadAngle'));
    expect(kotlinConst(kotlin, 'MIN_SWEEP'), dartConst('kGaugeMinSweep'));
    expect(kotlinConst(kotlin, 'BAND_RATIO'), dartConst('_bandRatio'));
    expect(dart, contains('const double _cornerRatio = 4 / 9;'));
    expect(kotlinConst(kotlin, 'CORNER_RATIO'), closeTo(4 / 9, 1e-12));
    expect(
      read('lib/shared/widgets/gauge/rounded_sector_path.dart'),
      contains('(sweep - 0.5) / 2 * _deg'),
    );
    expect(kotlin, contains('(sweep - 0.5) / 2 * DEG'));
    expect(dart, contains('(1 - 1 / progress).clamp(8 / span, 1.0)'));
    expect(kotlin, contains('min(maxOf(1 - 1 / progress, 8 / span), 1.0)'));
  });

  test('the readout sizes are the web rules they port', () {
    final kotlin = read('$widgetDir/gauge/GaugeReadout.kt');
    final size = read('../../lib/core/ui/gauge-figure-size.ts');
    final lines = read('../../components/shared/gauge/gauge-lines.ts');
    final layout = read('../../lib/core/ui/gauge-readout-layout.ts');
    final metrics = read('../../lib/core/ui/gauge-strip-metrics.ts');
    final dial = read('../../components/shared/gauge/macro-dial.tsx');
    final strip = read('../../lib/core/ui/gauge-strip-layout.ts');

    expect(size, contains('FIGURE_RATIO = { calorie: 0.39, macro: 0.44 }'));
    expect(kotlinConst(kotlin, 'FIGURE_RATIO_CALORIE'), 0.39);
    expect(kotlinConst(kotlin, 'FIGURE_RATIO_MACRO'), 0.44);
    expect(size, contains('FIGURE_MIN_PX = 11;'));
    expect(kotlinConst(kotlin, 'FIGURE_MIN'), 11);
    expect(size, contains('FIGURE_MAX_PX = 44;'));
    expect(kotlinConst(kotlin, 'FIGURE_MAX'), 44);
    expect(kotlin, contains('width <= 0.9 * tipOpening(r)'));
    for (final rule in [
      'clamp(Math.round(0.18 * radius), 11, 16)',
      'clamp(Math.round(0.25 * radius), 10, 14)',
      'Math.round(fontSize * 1.15)',
      '1.482 * radius',
    ]) {
      expect(size, contains(rule));
    }
    expect(kotlin, contains('jsRound(0.18 * r).coerceIn(11.0, 16.0)'));
    expect(kotlin, contains('jsRound(0.25 * r).coerceIn(10.0, 14.0)'));
    expect(kotlin, contains('jsRound(fontSize * 1.15)'));
    expect(kotlin, contains('1.482 * r'));
    expect(lines, contains('SHORT_LINE_LEADING = 4;'));
    expect(kotlin, contains('SHORT_LINE_LEADING = 4.0'));
    expect(lines, contains("dial === 'calorie' ? Math.min(unit, meta) : meta"));
    expect(kotlin, contains('minOf(unit, metaSize(r))'));
    expect(layout, contains('GAUGE_LINE_GAP = 2;'));
    expect(kotlinConst(kotlin, 'LINE_GAP'), 2);
    expect(metrics, contains('LABEL_GAP = 2;'));
    expect(kotlinConst(kotlin, 'LABEL_GAP'), 2);
    expect(metrics, contains('Math.round(gaugeMetaSize(radius) * 1.3)'));
    expect(kotlin, contains('jsRound(metaSize(r) * 1.3)'));
    expect(dial, contains('Math.max(12, Math.round(radius * 0.3))'));
    expect(kotlin, contains('maxOf(12.0, jsRound(r * 0.3))'));
    expect(strip, contains('MACRO_MIN_RADIUS = 26;'));
    expect(
      kotlinConst(read('$widgetDir/gauge/DialRow.kt'), 'MACRO_RADIUS'),
      26,
    );
  });

  test('the card sizes are the iOS card sizes', () {
    final kotlin = read('$widgetDir/TodayWidgetRenderer.kt');
    final swift = read('ios/TodayWidget/TodayWidgetView.swift');
    for (final (k, s) in [
      ('MARGIN', 'margin'),
      ('DATE_SIZE', 'dateSize'),
      ('DATE_LINE_BOX', 'dateLineBox'),
      ('DATE_GAP', 'dateGap'),
      ('MEALS_GAP', 'mealsGap'),
      ('CALORIE_RADIUS_CAP', 'calorieRadiusCap'),
    ]) {
      final swiftValue = double.parse(
        RegExp(
          'static let $s: Double = ([0-9.]+)',
        ).firstMatch(swift)!.group(1)!,
      );
      expect(kotlinConst(kotlin, k), swiftValue, reason: k);
    }
    final meals = read('$widgetDir/meals/MealList.kt');
    expect(
      read('ios/TodayWidget/Meals/MealRow.swift'),
      contains('size: Double = 14'),
    );
    expect(kotlinConst(meals, 'SIZE'), 14);
    expect(kotlinConst(meals, 'LINE_BOX'), 18);
    expect(kotlinConst(meals, 'ROW_GAP'), 8);
  });

  test('the JSON the app writes is the JSON the widget parses', () {
    final kotlin = read('$widgetDir/TodaySnapshot.kt');
    final parse = kotlin.split('fun parse(')[1].split('\n    }\n')[0];
    final keys = {
      for (final m in RegExp(r'get\w+\("(\w+)"\)').allMatches(parse))
        m.group(1)!,
    };
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
    expect(keys, containsAll(snapshot.keys));
    expect(keys, containsAll(kTodayWidgetCopyKeys.keys));
    expect(keys, containsAll((snapshot['target']! as Map).keys));
    expect(keys, containsAll(['time', 'text', 'kcal']));
    expect(
      todayWidgetSignedOut(date: 'd', locale: 'en', tr: (k) => k).keys.toSet(),
      snapshot.keys.toSet(),
    );
    expect(
      kotlin,
      contains('const val VERSION = $kTodayWidgetSnapshotVersion'),
    );
    // …and the placeholders it fills are the ones the l10n strings carry.
    final dial = read('$widgetDir/gauge/CalorieDial.kt');
    for (final name in ['left', 'over', 'logged', 'target']) {
      expect(dial, contains('"$name" to'));
    }
  });

  test('one prefs file, one key, one provider, one tap link', () {
    final store = read('$widgetDir/TodaySnapshot.kt');
    expect(store, contains('KEY = "$kTodayWidgetKey"'));
    // home_widget's own SharedPreferences file, which saveWidgetData writes on
    // Android (the App Group id is iOS-only).
    expect(store, contains('PREFERENCES = "HomeWidgetPreferences"'));
    final plugin = Directory(
      '${Platform.environment['HOME']}/.pub-cache/hosted/pub.dev/home_widget-0.10.0',
    );
    if (plugin.existsSync()) {
      expect(
        read(
          '${plugin.path}/android/src/main/kotlin/es/antonborri/home_widget/HomeWidgetPlugin.kt',
        ),
        contains('const val PREFERENCES = "HomeWidgetPreferences"'),
      );
    }
    expect(read('pubspec.yaml'), contains('home_widget: ^0.10.0'));

    // The class the app broadcasts to is the class that exists, in the
    // package its path says, and the manifest registers it as a widget.
    final provider = read('$widgetDir/TodayWidgetProvider.kt');
    final pkg =
        RegExp(
          r'^package ([\w.]+)',
          multiLine: true,
        ).firstMatch(provider)!.group(1)!;
    expect('$pkg.TodayWidgetProvider', kTodayWidgetAndroidProvider);
    expect(
      widgetDir
          .replaceFirst('android/app/src/main/kotlin/', '')
          .replaceAll('/', '.'),
      pkg,
    );
    final xml = read(manifest);
    expect(xml, contains('android:name=".todaywidget.TodayWidgetProvider"'));
    expect(
      read('android/app/build.gradle.kts'),
      contains('namespace = "fit.kallo.app"'),
    );
    expect(xml, contains('android:resource="@xml/today_widget_info"'));
    expect(
      xml,
      contains(
        '<action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>',
      ),
    );

    // The tap is the link Dart routes, and MainActivity is registered for it.
    final link = RegExp(r'const val LINK = "([^"]+)"').firstMatch(provider)!;
    final uri = Uri.parse(link.group(1)!);
    expect(isTodayWidgetLink(uri), isTrue);
    expect(
      xml,
      contains(
        '<data android:scheme="${uri.scheme}" android:host="${uri.host}"/>',
      ),
    );
  });

  test('the widget resources exist in both languages', () {
    const res = 'android/app/src/main/res';
    final info = read('$res/xml/today_widget_info.xml');
    expect(info, contains('@layout/today_widget'));
    expect(File('$res/layout/today_widget.xml').existsSync(), isTrue);
    expect(
      File('$res/drawable-nodpi/today_widget_preview.png').existsSync(),
      isTrue,
    );
    for (final macro in ['protein', 'carbs', 'fat']) {
      expect(
        File('$res/drawable/today_widget_$macro.xml').existsSync(),
        isTrue,
        reason: macro,
      );
    }
    for (final dir in ['values', 'values-vi']) {
      final strings = read('$res/$dir/today_widget_strings.xml');
      expect(strings, contains('name="today_widget_name"'), reason: dir);
      expect(strings, contains('name="today_widget_description"'), reason: dir);
    }
    // The fonts the renderer loads are the ones the app bundles.
    final type = read('$widgetDir/draw/WidgetType.kt');
    expect(type, contains('flutter_assets/assets/google_fonts'));
    for (final weight in ['Regular', 'Medium', 'SemiBold']) {
      expect(type, contains('face("$weight")'));
      expect(
        File('assets/google_fonts/BeVietnamPro-$weight.ttf').existsSync(),
        isTrue,
      );
    }
    expect(read('pubspec.yaml'), contains('- assets/google_fonts/'));
  });
}
