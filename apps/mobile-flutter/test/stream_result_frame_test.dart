import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/models/meal.dart';
import 'package:nham_mobile/models/vessel.dart';
import 'package:nham_mobile/models/streaming.dart';

/// The SSE `result` frame must survive whatever the server puts in `vessel`.
///
/// `api_client` decodes every frame inside a bare `catch (_) { return null; }`,
/// so a type error anywhere under `ParsedMeal.fromJson` does not surface as a
/// parse error — it drops the entire analysis, the socket closes, and the user
/// gets a generic "analysis failed" AFTER the estimating stage with nothing in
/// the logs naming the cause. The vessel is decoration; it may never cost
/// someone their meal.
///
/// Frame modelled on a real failing report:
/// "3 piece of salmon + 2 steaks + 1 cup of milk + 1 plate of spaghetti".
const _raw = '''
{"type":"result","data":{"mealName":"salmon, steak, milk, spaghetti",
"items":[
 {"id":"item-1","name":"salmon","quantity":450,"unit":"g",
  "macros":{"calories":900,"protein":90,"carbs":0,"fat":55},
  "vessel":{"family":"piece","tier":4,"count":3,"kind":"fish"}},
 {"id":"item-2","name":"steak","quantity":400,"unit":"g",
  "macros":{"calories":1000,"protein":80,"carbs":0,"fat":75},
  "vessel":{"family":"piece","tier":4,"count":2,"kind":"meat"}},
 {"id":"item-3","name":"milk","quantity":244,"unit":"g",
  "macros":{"calories":149,"protein":8,"carbs":12,"fat":8},
  "vessel":{"family":"cup","tier":2,"dishClass":"drink"}},
 {"id":"item-4","name":"spaghetti","quantity":520,"unit":"g",
  "macros":{"calories":800,"protein":28,"carbs":150,"fat":9},
  "vessel":{"family":"plate","tier":3,"dishClass":"solid"}}],
"totalMacros":{"calories":2849,"protein":206,"carbs":162,"fat":147}}}
''';

void main() {
  test('a four-dish frame with every vessel family decodes', () {
    final json = jsonDecode(_raw) as Map<String, dynamic>;
    final event = StreamEvent.fromJson(json) as ResultEvent;
    expect(event.data.items, hasLength(4));
    expect(event.data.items.map((i) => i.vessel).whereType<PieceVessel>(),
        hasLength(2));
    expect(event.data.items.map((i) => i.vessel).whereType<ContainerVessel>(),
        hasLength(2));
  });

  test('a malformed vessel degrades to null instead of throwing', () {
    for (final bad in <Map<String, dynamic>>[
      {'family': 'cup', 'tier': '2', 'dishClass': 'drink'},
      {'family': 'piece', 'tier': 4, 'count': '3', 'kind': 'fish'},
      {'family': 5, 'tier': 1, 'dishClass': 'solid'},
      {'family': 'cup', 'tier': null, 'dishClass': 'drink'},
      {'family': 'trencher', 'tier': 2, 'dishClass': 'solid'},
      {'family': 'piece', 'tier': 4, 'count': 3, 'kind': 'venison'},
      <String, dynamic>{},
    ]) {
      final item = {
        'id': 'x', 'name': 'y', 'quantity': 1, 'unit': 'g',
        'macros': {'calories': 1, 'protein': 1, 'carbs': 1, 'fat': 1},
        'vessel': bad,
      };
      // Not just "didn't throw" — a non-null wrong vessel passes that and is
      // exactly what the picker can't render.
      expect(MealItem.fromJson(item).vessel, isNull,
          reason: 'accepted malformed vessel payload $bad');
    }
  });

  test('a whole-number double tier is accepted, not discarded', () {
    // `4.0`, not `4`. JSON has one number type and a transport is free to
    // round-trip an integer as a double, so rejecting it would silently drop
    // the portion line on a payload that is entirely well-formed. This sat in
    // the malformed table above until the assertion there was tightened from
    // "doesn't throw" to "is null" — precisely the mislabelling a weak
    // assertion hides.
    final item = {
      'id': 'x', 'name': 'y', 'quantity': 1, 'unit': 'g',
      'macros': {'calories': 1, 'protein': 1, 'carbs': 1, 'fat': 1},
      'vessel': {'family': 'piece', 'tier': 4.0, 'count': 3, 'kind': 'fish'},
    };
    expect(MealItem.fromJson(item).vessel, isA<PieceVessel>());
  });
}

