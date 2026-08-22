import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/relog/relog_label.dart';
import 'package:kallo_mobile/models/logging/relog.dart';

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

  group('unmarkPicks', () {
    // Review flagged `replaceAll` as prefix-unsafe: replace `/Phở` before
    // `/Phở bò` and the longer label's text is supposedly corrupted. It is not,
    // and the reason is worth pinning — the replacement is a strict DELETION of
    // the leading slash, so stripping it via a shorter prefix strips it from
    // the longer string that starts with that prefix too. Both orders converge.
    test('is order-independent across prefix-colliding labels', () {
      const text = '/Phở bò và /Phở';
      expect(
        unmarkPicks(text, [_pick('/Phở'), _pick('/Phở bò')]),
        'Phở bò và Phở',
      );
      expect(
        unmarkPicks(text, [_pick('/Phở bò'), _pick('/Phở')]),
        'Phở bò và Phở',
      );
    });

    test('leaves a label that never carried a marker alone', () {
      expect(unmarkPicks('Phở bò', [_pick('Phở bò')]), 'Phở bò');
    });
  });

  group('the card reads back what was typed', () {
    test('a pick that came FIRST stays first', () {
      // The reported bug: the label was rebuilt as `[freeText, ...pickNames]`,
      // so typing the pick at the start hoisted the typed remainder in front of
      // it and the card read "+ 1 kem vani, 1 cơm gà…" for a sentence that
      // began with the dish.
      const typed = '/1 cơm gà Hải Nam + 1 kem vani';
      expect(
        unmarkPicks(typed, [_pick('/1 cơm gà Hải Nam')]),
        '1 cơm gà Hải Nam + 1 kem vani',
      );
    });

    test('a pick in the MIDDLE keeps its place', () {
      expect(
        unmarkPicks('sáng /Phở bò rồi đi làm', [_pick('/Phở bò')]),
        'sáng Phở bò rồi đi làm',
      );
    });

    test('several picks keep composer order', () {
      expect(
        unmarkPicks('/Phở bò và /Cà phê và bánh mì', [
          _pick('/Phở bò'),
          _pick('/Cà phê'),
        ]),
        'Phở bò và Cà phê và bánh mì',
      );
    });
  });
}
