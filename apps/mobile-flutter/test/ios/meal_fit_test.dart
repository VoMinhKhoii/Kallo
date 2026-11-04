// The large widget's "newest meals that fit" rule (ios/TodayWidget/MealFit.swift),
// run for real: the Swift is compiled with test/ios/meal_fit_check.swift and its
// cases executed. Swift ships on macOS and on GitHub's Ubuntu runners; where
// `swiftc` is missing the test says so and skips rather than passing silently.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final swiftc = Process.runSync('which', ['swiftc']).exitCode == 0;

  test(
    'shows the newest meals that fit, oldest dropped, no gaps',
    () async {
      final out = Directory.systemTemp.createTempSync('meal_fit');
      addTearDown(() => out.deleteSync(recursive: true));
      final binary = '${out.path}/meal_fit_check';
      final build = await Process.run('swiftc', [
        'ios/TodayWidget/MealFit.swift',
        'test/ios/meal_fit_check.swift',
        '-o',
        binary,
      ]);
      expect(build.exitCode, 0, reason: '${build.stdout}${build.stderr}');

      final run = await Process.run(binary, const []);
      final lines = (run.stdout as String).trim().split('\n');
      expect(lines.where((l) => l.startsWith('FAIL')), isEmpty);
      expect(lines.where((l) => l.startsWith('ok ')), hasLength(7));
      expect(run.exitCode, 0);
    },
    skip: swiftc ? false : 'swiftc is not on PATH',
    timeout: const Timeout(Duration(minutes: 3)),
  );
}
