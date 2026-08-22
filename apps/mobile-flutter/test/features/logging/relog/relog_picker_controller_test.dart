import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/relog/relog_picker_controller.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/models/logging/relog.dart';

const _candidate = RelogDishCandidate(
  sourceMealId: 'meal-1',
  name: 'Phở bò',
  occurrenceCount: 1,
  lastLoggedAt: '2026-07-01T00:00:00.000Z',
  summary: RelogMacroSummary(
    caloriesKcal: 410,
    proteinG: 20,
    carbohydrateG: 60,
    fatG: 10,
  ),
  mealItemOrder: 0,
  ingredientCount: 3,
);

void main() {
  late MentionTextEditingController composer;
  late RelogPickerController picker;
  late int rebuilds;

  setUp(() {
    composer = MentionTextEditingController();
    rebuilds = 0;
    picker = RelogPickerController(
      composer: composer,
      onChanged: () => rebuilds++,
    );
  });

  tearDown(() {
    picker.dispose();
    composer.dispose();
  });

  /// Type [value] with the caret at its end and let the picker read it, the way
  /// the composer's sync callback does.
  void type(String value, {bool enabled = true}) {
    composer.value = TextEditingValue(
      text: value,
      selection: TextSelection.collapsed(offset: value.length),
    );
    picker.sync(enabled: enabled);
  }

  testWidgets('opening the picker resolves without waiting out the debounce', (
    tester,
  ) async {
    await tester.pumpWidget(const SizedBox.shrink());
    type('/');
    expect(picker.query, '');
  });

  testWidgets('typing a dish name is one query, not one per keystroke', (
    tester,
  ) async {
    await tester.pumpWidget(const SizedBox.shrink());
    type('/');
    type('/p');
    type('/ph');
    type('/pho');
    expect(picker.query, '', reason: 'still showing staples mid-word');

    await tester.pump(const Duration(milliseconds: 300));
    expect(picker.query, 'pho');
  });

  testWidgets('backspacing to a bare slash resolves immediately again', (
    tester,
  ) async {
    await tester.pumpWidget(const SizedBox.shrink());
    type('/');
    type('/pho');
    await tester.pump(const Duration(milliseconds: 300));
    expect(picker.query, 'pho');

    type('/');
    expect(
      picker.query,
      '',
      reason: 'staples are one cached list, not a search',
    );
  });

  testWidgets('cheat and manual modes never open the picker', (tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    type('/pho', enabled: false);
    expect(picker.query, isNull);
  });

  testWidgets('a dismissed token stays shut while it is typed on', (
    tester,
  ) async {
    await tester.pumpWidget(const SizedBox.shrink());
    type('/');
    picker.dismiss();
    expect(picker.query, isNull);

    type('/p');
    await tester.pump(const Duration(milliseconds: 300));
    expect(picker.query, isNull);
  });

  testWidgets('a fresh slash reopens after a dismissal', (tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    type('/');
    picker.dismiss();
    type('/p');
    type('/p x /');
    expect(picker.query, '');
  });

  testWidgets('a pick lands in the composer and closes the picker', (
    tester,
  ) async {
    await tester.pumpWidget(const SizedBox.shrink());
    type('/');
    expect(picker.select(_candidate), isTrue);
    expect(composer.text, '/Phở bò ');
    expect(composer.mentions, hasLength(1));
    expect(picker.query, isNull);
  });

  testWidgets('a pick past the staged cap is reported, not swallowed', (
    tester,
  ) async {
    await tester.pumpWidget(const SizedBox.shrink());
    for (var i = 0; i < kRelogMaxStaged; i++) {
      type('${composer.text}/');
      expect(picker.select(_candidate), isTrue);
    }
    type('${composer.text}/');
    expect(picker.select(_candidate), isFalse);
    expect(composer.mentions, hasLength(kRelogMaxStaged));
  });

  testWidgets('selecting with the picker shut is a no-op', (tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    expect(picker.select(_candidate), isTrue);
    expect(composer.text, isEmpty);
    expect(rebuilds, 0);
  });

  testWidgets('disposing cancels a debounce that has not fired', (
    tester,
  ) async {
    await tester.pumpWidget(const SizedBox.shrink());
    type('/');
    type('/pho');
    picker.dispose();
    // A pending timer left behind would fail the test outright; assert the
    // query too so the guard cannot pass by accident.
    await tester.pump(const Duration(milliseconds: 300));
    expect(picker.query, '');
  });
}
