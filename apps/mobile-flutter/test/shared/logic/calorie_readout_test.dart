import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/models/nutrition/nutrition_enums.dart';
import 'package:kallo_mobile/shared/logic/calorie_readout.dart';

const double _target = 2000;

CalorieReadout _readout(double logged, MacroGoal? goal) =>
    calorieReadout(logged: logged, target: _target, goal: goal);

void main() {
  test('leads a cutter with what is left to spend', () {
    final readout = _readout(741, MacroGoal.cutting);

    expect(readout.headline, 1259);
    expect(readout.framing, CalorieFraming.remaining);
    expect(readout.left, 1259);
    expect(readout.over, isNull);
  });

  test('leads every other goal with what has been logged', () {
    for (final goal in [MacroGoal.bulking, MacroGoal.maintaining, null]) {
      final readout = _readout(741, goal);

      expect(readout.headline, 741, reason: '$goal');
      expect(readout.framing, CalorieFraming.logged, reason: '$goal');
      expect(readout.left, 1259, reason: '$goal');
    }
  });

  test('never hands a cutter a negative headline', () {
    final readout = _readout(2341, MacroGoal.cutting);

    expect(readout.headline, 0);
    // The deficit is spent, but the overshoot is not hidden.
    expect(readout.over, 341);
  });

  test('names the overshoot for a goal that counts up', () {
    final readout = _readout(2341, MacroGoal.bulking);

    expect(readout.headline, 2341);
    expect(readout.left, 0);
    expect(readout.over, 341);
  });
}
