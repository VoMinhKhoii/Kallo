import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/logic/relog/composer_submit_plan.dart';
import 'package:nham_mobile/models/relog.dart';

RelogStagedEntry _entry(String label, {int order = 0}) => RelogStagedEntry(
  stageId: 'stage-$label',
  ref: RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: order),
  label: label,
  partCount: 3,
  summary: const RelogMacroSummary(caloriesKcal: 410),
);

void main() {
  test('text with no picks is an ordinary AI analysis', () {
    final plan = planComposerSubmit(
      isNormal: true,
      staged: const [],
      text: 'phở bò một tô',
      freeText: 'phở bò một tô',
    );
    expect(plan, isA<PlainAnalysis>());
    expect((plan as PlainAnalysis).text, 'phở bò một tô');
  });

  test('picks with no free text stage a deterministic relog — no AI', () {
    final plan = planComposerSubmit(
      isNormal: true,
      staged: [_entry('Phở bò'), _entry('Cà phê', order: 1)],
      text: 'Phở bò Cà phê ',
      freeText: '',
    );
    expect(plan, isA<PureRelog>());
    expect((plan as PureRelog).refs, const [
      RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: 0),
      RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: 1),
    ]);
  });

  test('free text alongside picks analyzes the text ALONE, picks as refs', () {
    final plan = planComposerSubmit(
      isNormal: true,
      staged: [_entry('Phở bò')],
      text: 'Phở bò và 2 quả trứng',
      freeText: 'và 2 quả trứng',
    );
    expect(plan, isA<CombinedAnalysis>());
    final combined = plan as CombinedAnalysis;
    // The relogged dish must never reach the AI — it is copied verbatim, and
    // re-estimating it would produce different numbers than the card it came
    // from.
    expect(combined.freeText, 'và 2 quả trứng');
    expect(combined.freeText.contains('Phở bò'), isFalse);
    expect(combined.refs.single, const RelogDishRef(
      sourceMealId: 'meal-1',
      mealItemOrder: 0,
    ));
  });

  test('cheat mode never carries picks, even with a draft staged', () {
    // The picks survive a mode switch (only their UI hides). Without this gate
    // a leftover draft would relog dishes out of a cheat submit — and the
    // server rejects cheat+refs outright, so it would 400 rather than degrade.
    final plan = planComposerSubmit(
      isNormal: false,
      staged: [_entry('Phở bò')],
      text: 'đám cưới',
      freeText: 'đám cưới',
    );
    expect(plan, isA<PlainAnalysis>());
    expect((plan as PlainAnalysis).text, 'đám cưới');
  });

  group('retry', () {
    // A retry replays the FAILED message, which was already the stripped free
    // text — so `text` and `freeText` are the same string.
    test('re-attaches the picks instead of logging the text alone', () {
      final plan = planComposerSubmit(
        isNormal: true,
        staged: [_entry('Phở bò')],
        text: 'và 2 quả trứng',
        freeText: 'và 2 quả trứng',
      );

      expect(
        plan,
        isA<CombinedAnalysis>(),
        reason: 'retrying without refs silently drops the picked dishes',
      );
      expect((plan as CombinedAnalysis).refs, hasLength(1));
    });

    test('stays a plain analysis when the picks are gone', () {
      final plan = planComposerSubmit(
        isNormal: true,
        staged: const [],
        text: 'phở bò một tô',
        freeText: 'phở bò một tô',
      );
      expect(plan, isA<PlainAnalysis>());
    });
  });

  test('a meal pick stages as a meal reference', () {
    final plan = planComposerSubmit(
      isNormal: true,
      staged: const [
        RelogStagedEntry(
          stageId: 's',
          ref: RelogMealRef(sourceMealId: 'meal-9'),
          label: 'bún chả với trà đá',
          partCount: 2,
          summary: RelogMacroSummary(caloriesKcal: 700),
        ),
      ],
      text: 'bún chả với trà đá ',
      freeText: '',
    );
    expect(
      (plan as PureRelog).refs.single,
      const RelogMealRef(sourceMealId: 'meal-9'),
    );
  });
}
