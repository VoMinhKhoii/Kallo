import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/cheat/occasion_search.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';

RecentCheatOccasion _o(String text) =>
    RecentCheatOccasion(mealId: text, rawInput: text, loggedAt: '2026-09-27');

final _sushi = _o('sushi (cá hồi, cá trứng)');
final _thai = _o('1 bữa đồ thái (tháp chàm, lẩu)');
final _rice = _o('30 gr cơm + 2 miếng gà rán');
final _bo = _o('phở bò');
final _bo2 = _o('bánh mì bơ');
final _all = [_sushi, _thai, _rice, _bo, _bo2];

List<String> _search(String q) =>
    filterCheatOccasions(_all, q).map((o) => o.rawInput).toList();

void main() {
  test('an empty or blank field lists everything, newest first', () {
    expect(filterCheatOccasions(_all, ''), _all);
    expect(filterCheatOccasions(_all, '   '), _all);
  });

  test('a partial word matches, case-insensitively', () {
    expect(_search('SUS'), [_sushi.rawInput]);
  });

  test('every word must match, in any order', () {
    expect(_search('gà cơm'), [_rice.rawInput]);
    expect(_search('gà sushi'), isEmpty);
  });

  test('a word typed without diacritics folds them away', () {
    expect(_search('do thai'), [_thai.rawInput]);
    expect(_search('ca hoi'), [_sushi.rawInput]);
  });

  test('a word typed WITH diacritics keeps them load-bearing', () {
    // bò is beef, bơ is butter: the accent is the whole difference.
    expect(_search('bò'), [_bo.rawInput]);
    expect(_search('bơ'), [_bo2.rawInput]);
    // Unaccented, both are fair game.
    expect(_search('bo'), [_bo.rawInput, _bo2.rawInput]);
  });

  test('punctuation in the query is ignored', () {
    expect(_search('(tháp,'), [_thai.rawInput]);
  });

  test('a new meal matches nothing', () {
    expect(_search('Korean BBQ buffet'), isEmpty);
  });

  test('foldVietnamese strips composed and decomposed marks alike', () {
    expect(foldVietnamese('đồ thái'), 'do thai');
    // "ồ" as o + combining circumflex + combining grave (NFD).
    expect(foldVietnamese('đồ'), 'do');
  });
}
