import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/logic/relog/relog_label.dart';
import 'package:nham_mobile/models/relog.dart';

RelogStagedEntry _pick(String label) => RelogStagedEntry(
  stageId: 's-$label',
  ref: const RelogMealRef(sourceMealId: 'meal-1'),
  label: label,
);

void main() {
  group('relogPickName', () {
    test('drops the slash the pick was summoned with', () {
      expect(relogPickName(_pick('/Phở bò')), 'Phở bò');
    });

    test('leaves a label that never carried one alone', () {
      expect(relogPickName(_pick('Phở bò')), 'Phở bò');
    });

    test('strips only the FIRST slash', () {
      // Real dish names contain slashes ("Bánh mì 1/2"). Stripping every one
      // would rename the dish in the card's label.
      expect(relogPickName(_pick('/Bánh mì 1/2')), 'Bánh mì 1/2');
    });
  });

  group('combinedRelogLabel', () {
    test('reads as the typed text THEN the picks', () {
      // What the server writes for the same submit:
      // buildRelogRawInput([message, ...dishNames]).
      expect(
        combinedRelogLabel('và 2 quả trứng', ['Phở bò']),
        'và 2 quả trứng, Phở bò',
      );
    });

    test('a submit with no picks is labelled with exactly what was typed', () {
      expect(combinedRelogLabel('phở bò một tô', const []), 'phở bò một tô');
    });

    test('picks alone need no leading comma', () {
      expect(combinedRelogLabel('', ['Phở bò', 'Cà phê']), 'Phở bò, Cà phê');
    });

    test('truncates at the column bound the server truncates at', () {
      // `meals.raw_input` is bounded server-side; a label built here that ran
      // past it would render one string and persist another.
      final long = List.filled(60, 'Cà phê sữa đá').join(', ');
      final label = combinedRelogLabel(long, ['Phở bò']);
      expect(label.length, kRelogRawInputMax);
      expect(label.endsWith('…'), isTrue);
    });

    test('leaves a label that exactly fits unchanged', () {
      final exact = 'x' * kRelogRawInputMax;
      expect(combinedRelogLabel(exact, const []), exact);
    });
  });
}
