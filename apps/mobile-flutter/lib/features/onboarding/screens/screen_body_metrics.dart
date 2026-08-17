import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/profile/onboarding.dart';
import '../../../shared/logic/tdee.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../widgets/body_metrics/about_you_fields.dart';
import '../widgets/body_metrics/dotted_border_box.dart';
import '../widgets/body_metrics/goal_tuning.dart';

/// Step-2 form values + computed targets, reported up when the body-metrics
/// schema passes (mirrors RN `ScreenOneData`). Keys match the RN payload so the
/// `POST /api/v1/onboarding/screen` `data` map is byte-compatible.
///
/// Lives here rather than in `data/` for the same reason `ScreenThreeDefaults`
/// lives in `screen_cooking.dart`: in this feature the screen owns the contract
/// it reports.
class ScreenTwoValues {
  final String biologicalSex; // 'male' | 'female'
  final double weightKg;
  final int heightCm;
  final int age;
  final String activityLevel;
  final String goal;
  final double? aggression;
  final String carbSplit;
  final double? deficitOverride;
  final int tdeeKcal;
  final int calorieTarget;
  final int proteinTargetG;
  final int carbsTargetG;
  final int fatTargetG;

  const ScreenTwoValues({
    required this.biologicalSex,
    required this.weightKg,
    required this.heightCm,
    required this.age,
    required this.activityLevel,
    required this.goal,
    required this.aggression,
    required this.carbSplit,
    required this.deficitOverride,
    required this.tdeeKcal,
    required this.calorieTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
  });

  Map<String, dynamic> toJson() => {
    'biologicalSex': biologicalSex,
    'weightKg': weightKg,
    'heightCm': heightCm,
    'age': age,
    'activityLevel': activityLevel,
    'goal': goal,
    'aggression': aggression,
    'carbSplit': carbSplit,
    'deficitOverride': deficitOverride,
    'tdeeKcal': tdeeKcal,
    'calorieTarget': calorieTarget,
    'proteinTargetG': proteinTargetG,
    'carbsTargetG': carbsTargetG,
    'fatTargetG': fatTargetG,
  };
}

/// Partial seed for step 2 (from a saved profile / re-entered wizard state).
class ScreenTwoDefaults {
  final String? biologicalSex;
  final double? weightKg;
  final int? heightCm;
  final int? age;
  final String activityLevel;
  final String goal;
  final double? aggression;
  final String carbSplit;
  final double? deficitOverride;

  const ScreenTwoDefaults({
    this.biologicalSex,
    this.weightKg,
    this.heightCm,
    this.age,
    this.activityLevel = 'light',
    this.goal = 'maintaining',
    this.aggression = 0.5,
    this.carbSplit = 'moderate_carb',
    this.deficitOverride,
  });
}

/// RN port of `components/onboarding/screens/screen-body-metrics.tsx` (step 2).
class ScreenBodyMetrics extends StatefulWidget {
  const ScreenBodyMetrics({
    super.key,
    required this.defaultValues,
    required this.onChange,
  });

  final ScreenTwoDefaults defaultValues;
  final ValueChanged<ScreenTwoValues> onChange;

  @override
  State<ScreenBodyMetrics> createState() => _ScreenBodyMetricsState();
}

class _ScreenBodyMetricsState extends State<ScreenBodyMetrics> {
  late String? _sex = widget.defaultValues.biologicalSex;
  late double? _weight = widget.defaultValues.weightKg;
  late int? _height = widget.defaultValues.heightCm;
  late int? _age = widget.defaultValues.age;
  late String _activity = widget.defaultValues.activityLevel;
  late String _goal = widget.defaultValues.goal;
  late double? _aggression = widget.defaultValues.aggression ?? 0.5;
  late String _carbSplit = widget.defaultValues.carbSplit;

  // Inline validation errors (body-metrics schema), keyed by field.
  String? _weightError;
  String? _heightError;
  String? _ageError;

  bool get _allMetricsFilled =>
      _sex != null && _weight != null && _height != null && _age != null;

  int? get _tdee {
    if (!_allMetricsFilled) return null;
    final bmr = calcBMR(
      biologicalSex: BiologicalSex.values.byName(_sex!),
      weightKg: _weight!,
      heightCm: _height!,
      age: _age!,
    );
    return calcTDEE(bmr, activityLevelFromString(_activity));
  }

  MacroTargets? get _finalTargets {
    final tdee = _tdee;
    if (tdee == null) return null;
    return calcDailyTargets(
      tdee,
      Goal.values.byName(_goal),
      _aggression,
      carbSplitFromString(_carbSplit),
    );
  }

  /// Body-metrics range validation (mirrors the zod schema messages).
  bool _validate() {
    String? wErr;
    String? hErr;
    String? aErr;
    String tv(String k) => tr('validation.bodyMetrics.$k');

    if (_weight == null) {
      wErr = tv('weightRequired');
    } else if (_weight! < 30) {
      wErr = tv('weightMin');
    } else if (_weight! > 300) {
      wErr = tv('weightMax');
    }

    if (_height == null) {
      hErr = tv('heightRequired');
    } else if (_height! < 100) {
      hErr = tv('heightMin');
    } else if (_height! > 250) {
      hErr = tv('heightMax');
    }

    if (_age == null) {
      aErr = tv('ageRequired');
    } else if (_age! < 13) {
      aErr = tv('ageMin');
    } else if (_age! > 100) {
      aErr = tv('ageMax');
    }

    return wErr == null &&
        hErr == null &&
        aErr == null &&
        _sex != null &&
        (_goal == 'maintaining' || _aggression != null);
  }

  void _report() {
    final tdee = _tdee;
    final targets = _finalTargets;
    if (tdee == null || targets == null) return;
    if (!_validate()) return;
    widget.onChange(
      ScreenTwoValues(
        biologicalSex: _sex!,
        weightKg: _weight!,
        heightCm: _height!,
        age: _age!,
        activityLevel: _activity,
        goal: _goal,
        aggression: _aggression,
        carbSplit: _carbSplit,
        deficitOverride: widget.defaultValues.deficitOverride,
        tdeeKcal: tdee,
        calorieTarget: targets.calories.round(),
        proteinTargetG: targets.proteinG.round(),
        carbsTargetG: targets.carbsG.round(),
        fatTargetG: targets.fatG.round(),
      ),
    );
  }

  void _runValidationThenReport() {
    // Recompute inline range errors (RN reports field errors on blur; here we
    // surface them live alongside the report so the hero stays in sync).
    setState(() {
      String tv(String k) => tr('validation.bodyMetrics.$k');
      _weightError =
          _weight == null
              ? null
              : (_weight! < 30
                  ? tv('weightMin')
                  : (_weight! > 300 ? tv('weightMax') : null));
      _heightError =
          _height == null
              ? null
              : (_height! < 100
                  ? tv('heightMin')
                  : (_height! > 250 ? tv('heightMax') : null));
      _ageError =
          _age == null
              ? null
              : (_age! < 13
                  ? tv('ageMin')
                  : (_age! > 100 ? tv('ageMax') : null));
    });
    _report();
  }

  @override
  Widget build(BuildContext context) {
    final tdee = _tdee;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          tr('onboarding.bodyMetrics.title'),
          // tracking-tight: -0.025em × 24px ≈ -0.6
          style: KalloTextStyles.serifMedium(
            fontSize: 24,
          ).copyWith(letterSpacing: -0.6, color: KalloColors.text),
        ),
        const SizedBox(height: KalloSpacing.sp1),
        Text(
          tr('onboarding.bodyMetrics.subtitle'),
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: KalloSpacing.sp5), // space-y-5
        AboutYouFields(
          sex: _sex,
          weightKg: _weight,
          heightCm: _height,
          age: _age,
          activityLevel: _activity,
          weightError: _weightError,
          heightError: _heightError,
          ageError: _ageError,
          onSexChanged: (v) {
            setState(() => _sex = v);
            _report();
          },
          onWeightChanged: (v) {
            setState(() => _weight = v);
            _runValidationThenReport();
          },
          onHeightChanged: (v) {
            setState(() => _height = v);
            _runValidationThenReport();
          },
          onAgeChanged: (v) {
            setState(() => _age = v);
            _runValidationThenReport();
          },
          onActivityChanged: (v) {
            setState(() => _activity = v);
            _report();
          },
        ),
        const SizedBox(height: KalloSpacing.sp5), // space-y-5
        // Goal card (when TDEE known) or the dashed unlock placeholder.
        if (tdee != null)
          GoalTuning(
            tdee: tdee,
            goal: _goal,
            aggression: _aggression,
            carbSplit: _carbSplit,
            macros: _finalTargets,
            onGoalChanged: (g) {
              setState(() {
                _goal = g;
                if (g != 'maintaining' && (_aggression == null)) {
                  _aggression = 0.5;
                }
              });
              _report();
            },
            onAggressionChanged: (v) {
              setState(() => _aggression = v);
              _report();
            },
            onCarbSplitChanged: (v) {
              setState(() => _carbSplit = v);
              _report();
            },
          )
        else
          _buildUnlockPlaceholder(),
      ],
    );
  }

  // Dashed-border panel shown when metrics are incomplete (tdee == null).
  Widget _buildUnlockPlaceholder() {
    return DottedBorderBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('onboarding.bodyMetrics.unlockTitle'),
            style: dashBody(weight: FontWeight.w500),
          ),
          const SizedBox(height: KalloSpacing.sp1), // mt-1
          Text(tr('onboarding.bodyMetrics.unlockHint'), style: dashMeta()),
        ],
      ),
    );
  }
}
