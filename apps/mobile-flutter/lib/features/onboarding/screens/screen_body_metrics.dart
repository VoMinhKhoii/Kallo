import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/onboarding.dart';
import '../../../shared/widgets/decimal_input.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../../dashboard/logic/dashboard_format.dart' show formatCount;
import '../logic/tdee.dart';
import '../widgets/aggression_slider.dart';
import '../widgets/custom_select.dart';
import '../widgets/option_strip.dart';

/// Step-2 form values + computed targets, reported up when the body-metrics
/// schema passes (mirrors RN `ScreenOneData`). Keys match the RN payload so the
/// `POST /api/v1/onboarding/screen` `data` map is byte-compatible.
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

const List<String> _goals = ['cutting', 'maintaining', 'bulking'];
// Displayed High → Moderate → Low (default selection stays moderate_carb).
const List<String> _carbSplits = ['higher_carb', 'moderate_carb', 'lower_carb'];

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
      BodyMetrics(
        biologicalSex: BiologicalSex.values.byName(_sex!),
        weightKg: _weight!,
        heightCm: _height!,
        age: _age!,
        activityLevel: activityLevelFromString(_activity),
      ),
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

  @override
  Widget build(BuildContext context) {
    final tdee = _tdee;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          tr('onboarding.bodyMetrics.title'),
          // tracking-tight: -0.025em × 24px ≈ -0.6
          style: NhamTextStyles.serifMedium(
            fontSize: 24,
          ).copyWith(letterSpacing: -0.6, color: NhamColors.text),
        ),
        const SizedBox(height: NhamSpacing.sp1),
        Text(
          tr('onboarding.bodyMetrics.subtitle'),
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: NhamSpacing.sp5), // space-y-5
        // Metrics card.
        Container(
          padding: const EdgeInsets.all(NhamSpacing.sp5),
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: NhamColors.inputBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // No "About you" header: it repeated the subtitle above the
              // card almost word for word, and its ALL-CAPS eyebrow was a
              // fourth type size on the screen. The subtitle now carries the
              // "optional" half of what it used to say.
              _buildGrid(),
            ],
          ),
        ),
        const SizedBox(height: NhamSpacing.sp5), // space-y-5
        // Goal card (when TDEE known) or the dashed unlock placeholder.
        if (tdee != null) _buildGoalCard(tdee) else _buildUnlockPlaceholder(),
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
          const SizedBox(height: NhamSpacing.sp1), // mt-1
          Text(
            tr('onboarding.bodyMetrics.unlockHint'),
            style: dashMeta(),
          ),
        ],
      ),
    );
  }

  Widget _buildGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // biological sex (full) — two options, so a 2-segment strip rather than
        // a select popover (a tap-to-open menu for a binary choice).
        _FieldLabel(tr('onboarding.bodyMetrics.biologicalSex')),
        const SizedBox(height: 6),
        OptionStrip(
          value: _sex ?? '',
          options: [
            OptionStripItem(
              label: tr('onboarding.bodyMetrics.male'),
              value: 'male',
            ),
            OptionStripItem(
              label: tr('onboarding.bodyMetrics.female'),
              value: 'female',
            ),
          ],
          onChange: (v) {
            setState(() => _sex = v);
            _report();
          },
        ),
        const SizedBox(height: NhamSpacing.sp4),

        // weight + height row
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _Cell(
                label:
                    '${tr('onboarding.bodyMetrics.weight')} (${tr('onboarding.bodyMetrics.weightUnit')})',
                error: _weightError,
                child: DecimalInput(
                  value: _weight,
                  hintText: '65',
                  onValueChange: (v) {
                    setState(() => _weight = v);
                    _runValidationThenReport();
                  },
                ),
              ),
            ),
            const SizedBox(width: NhamSpacing.sp4),
            Expanded(
              child: _Cell(
                label:
                    '${tr('onboarding.bodyMetrics.height')} (${tr('onboarding.bodyMetrics.heightUnit')})',
                error: _heightError,
                child: DecimalInput(
                  integer: true,
                  value: _height?.toDouble(),
                  hintText: '170',
                  onValueChange: (v) {
                    setState(() => _height = v?.toInt());
                    _runValidationThenReport();
                  },
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp4),

        // age row (+ empty cell)
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _Cell(
                label: tr('onboarding.bodyMetrics.age'),
                error: _ageError,
                child: DecimalInput(
                  integer: true,
                  value: _age?.toDouble(),
                  hintText: '25',
                  onValueChange: (v) {
                    setState(() => _age = v?.toInt());
                    _runValidationThenReport();
                  },
                ),
              ),
            ),
            const SizedBox(width: NhamSpacing.sp4),
            const Expanded(child: SizedBox()),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp4),

        // activity level (full)
        _FieldLabel(tr('onboarding.bodyMetrics.activityLevel')),
        const SizedBox(height: 6),
        CustomSelect(
          value: _activity,
          options: [
            CustomSelectOption(
              label: tr('onboarding.bodyMetrics.sedentary'),
              value: 'sedentary',
            ),
            CustomSelectOption(
              label: tr('onboarding.bodyMetrics.light'),
              value: 'light',
            ),
            CustomSelectOption(
              label: tr('onboarding.bodyMetrics.moderate'),
              value: 'moderate',
            ),
            CustomSelectOption(
              label: tr('onboarding.bodyMetrics.veryActive'),
              value: 'very_active',
            ),
          ],
          onChange: (v) {
            setState(() => _activity = v);
            _report();
          },
        ),
      ],
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

  Widget _buildGoalCard(int tdee) {
    final targetCalories = _finalTargets?.calories ?? 0;
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp5),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: NhamColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // TDEE hero + goal control, with a bottom divider (border-[#EAE7E0]/80).
          _TdeeHero(tdee: tdee),
          const SizedBox(height: NhamSpacing.sp4), // gap-4
          _FieldLabel(tr('onboarding.bodyMetrics.goal')),
          const SizedBox(height: NhamSpacing.sp2), // mb-2
          _GoalStrip(
            value: _goal,
            onChange: (g) {
              setState(() {
                _goal = g;
                if (g != 'maintaining' && (_aggression == null)) {
                  _aggression = 0.5;
                }
              });
              _report();
            },
          ),
          const SizedBox(height: NhamSpacing.sp4), // pb-4 divider gap
          const _Divider(color: Color(0xCCE8E6DC)), // border @80%

          if (_goal != 'maintaining') ...[
            const SizedBox(height: NhamSpacing.sp4), // space-y-4
            AggressionSlider(
              value: _aggression,
              goal: _goal == 'cutting' ? 'cutting' : 'bulking',
              onChange: (v) {
                setState(() => _aggression = v);
                _report();
              },
            ),
          ],

          if (targetCalories > 0) ...[
            const SizedBox(height: NhamSpacing.sp4), // space-y-4
            // Daily-target hero card (gradient) — calorie target + caption +
            // P/C/F for the selected split. Sits right below the goal toggle.
            _DailyTargetCard(
              calorieTarget: targetCalories,
              tdee: tdee,
              goal: _goal,
              macros: _finalTargets,
            ),
            const SizedBox(height: NhamSpacing.sp4),
            _FieldLabel(tr('onboarding.bodyMetrics.carbSplit')),
            const SizedBox(height: NhamSpacing.sp2), // mb-2
            // Carb split cards (gap-2.5) — High / Moderate / Low.
            Column(
              children: [
                for (var i = 0; i < _carbSplits.length; i++) ...[
                  if (i > 0) const SizedBox(height: NhamSpacing.sp2_5),
                  _CarbCard(
                    id: _carbSplits[i],
                    active: _carbSplit == _carbSplits[i],
                    targetCalories: targetCalories,
                    onTap: () {
                      setState(() => _carbSplit = _carbSplits[i]);
                      _report();
                    },
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Daily-target card — a flat white surface showing the computed calorie
/// target, a "based on TDEE…" caption, and the selected split's macros.
/// Hierarchy comes from the hairline border, not an alpha gradient (matching
/// the dashboard token system: solid cards, one radius).
class _DailyTargetCard extends StatelessWidget {
  const _DailyTargetCard({
    required this.calorieTarget,
    required this.tdee,
    required this.goal,
    required this.macros,
  });

  final num calorieTarget;
  final int tdee;
  final String goal;
  final MacroTargets? macros;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final caption =
        StringBuffer()
          ..write(tr('onboarding.bodyMetrics.basedOnTdee'))
          ..write(
            ' ~${formatCount(tdee, locale)} ${tr('onboarding.bodyMetrics.kcal')}',
          );
    if (goal == 'maintaining') {
      caption.write(' · ${tr('onboarding.bodyMetrics.maintenance')}');
    } else {
      final sign = goal == 'cutting' ? '−' : '+';
      final delta = (tdee - calorieTarget).abs();
      final kind =
          goal == 'cutting'
              ? tr('onboarding.bodyMetrics.aggressionDeficit')
              : tr('onboarding.bodyMetrics.aggressionSurplus');
      caption.write(
        ' · $sign${formatCount(delta.round(), locale)} ${tr('onboarding.bodyMetrics.perDay')} $kind',
      );
    }

    final m = macros;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(NhamSpacing.sp5),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.inputBorder),
      ),
      child: Column(
        children: [
          Text(
            tr('onboarding.bodyMetrics.calorieTarget').toUpperCase(),
            textAlign: TextAlign.center,
            style: dashEyebrow(),
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: formatCount(calorieTarget.round(), locale)),
                TextSpan(
                  text: ' ${tr('onboarding.bodyMetrics.kcal')}',
                  style: dashMeta(),
                ),
              ],
            ),
            style: NhamTextStyles.serifRegular(
              fontSize: 36,
            ).copyWith(color: NhamColors.text),
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Text(
            caption.toString(),
            textAlign: TextAlign.center,
            style: dashMeta(),
          ),
          if (m != null) ...[
            const SizedBox(height: NhamSpacing.sp4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _macroCell(tr('onboarding.bodyMetrics.protein'), m.proteinG),
                _macroCell(tr('onboarding.bodyMetrics.carbs'), m.carbsG),
                _macroCell(tr('onboarding.bodyMetrics.fat'), m.fatG),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _macroCell(String label, num grams) {
    return Column(
      children: [
        Text(
          label.toUpperCase(),
          style: dashEyebrow(),
        ),
        const SizedBox(height: 2),
        Text(
          '${grams.round()}${tr('onboarding.bodyMetrics.grams')}',
          style: dashValue(),
        ),
      ],
    );
  }
}

/// TDEE hero: uppercase label + serif 36px "~{tdee}" + 18px sans "kcal".
class _TdeeHero extends StatelessWidget {
  const _TdeeHero({required this.tdee});
  final int tdee;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _FieldLabel(tr('onboarding.bodyMetrics.tdee')),
        const SizedBox(height: NhamSpacing.sp1), // mb-1
        Text.rich(
          TextSpan(
            children: [
              TextSpan(text: '~${formatCount(tdee, locale)} '),
              TextSpan(
                text: tr('onboarding.bodyMetrics.kcal'),
                style: dashMeta(),
              ),
            ],
          ),
          // text-4xl (36px) tracking-tighter
          style: NhamTextStyles.serifRegular(
            fontSize: 36,
          ).copyWith(letterSpacing: -1, color: NhamColors.text),
        ),
      ],
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => Container(height: 1, color: color);
}

/// A dashed (dotted) 1px border panel: rounded-[28px], bg #FFFCF8, p-5.
class DottedBorderBox extends StatelessWidget {
  const DottedBorderBox({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedBorderPainter(color: NhamColors.inputBorder, radius: 28),
      child: Container(
        padding: const EdgeInsets.all(NhamSpacing.sp5),
        decoration: BoxDecoration(
          color: NhamColors.cardCream, // #FFFCF8
          borderRadius: BorderRadius.circular(28),
        ),
        child: child,
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color, required this.radius});
  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint =
        Paint()
          ..color = color
          ..strokeWidth = 1
          ..style = PaintingStyle.stroke;
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    const dash = 5.0;
    const gap = 4.0;
    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(
          metric.extractPath(d, (d + dash).clamp(0, metric.length)),
          paint,
        );
        d += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) =>
      old.color != color || old.radius != radius;
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: dashEyebrow(),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.child, this.error});

  final String label;
  final Widget child;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FieldLabel(label),
        const SizedBox(height: 6),
        child,
        if (error != null) ...[
          const SizedBox(height: 6),
          Text(
            error!,
            style: dashMeta(color: NhamColors.danger),
          ),
        ],
      ],
    );
  }
}

class _GoalStrip extends StatelessWidget {
  const _GoalStrip({required this.value, required this.onChange});

  final String value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    final labels = {
      'maintaining': tr('onboarding.bodyMetrics.maintaining'),
      'cutting': tr('onboarding.bodyMetrics.cutting'),
      'bulking': tr('onboarding.bodyMetrics.bulking'),
    };
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp1),
      decoration: BoxDecoration(
        color: const Color(0x80E8E6DC), // hairline @50%
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: Row(
        children: [
          for (var i = 0; i < _goals.length; i++) ...[
            if (i > 0) const SizedBox(width: NhamSpacing.sp1),
            Expanded(
              child: _GoalButton(
                label: labels[_goals[i]]!,
                active: value == _goals[i],
                onTap: () => onChange(_goals[i]),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _GoalButton extends StatefulWidget {
  const _GoalButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_GoalButton> createState() => _GoalButtonState();
}

class _GoalButtonState extends State<_GoalButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // active bg-white #2C2416 shadow-sm; inactive #8B8682 + hover:text-#2C2416.
    final color =
        widget.active ? kInk : (_pressed ? kInk : kInkMuted);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: const Cubic(0.25, 0.1, 0.25, 1),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(
          vertical: NhamSpacing.sp1_5, // py-1.5
          horizontal: NhamSpacing.sp3, // px-3
        ),
        decoration:
            widget.active
                ? BoxDecoration(
                  color: NhamColors.elev,
                  borderRadius: BorderRadius.circular(NhamRadii.md),
                  boxShadow: const [NhamShadows.sm], // shadow-sm
                )
                : const BoxDecoration(),
        child: Text(
          widget.label,
          style: dashBody(color: color, weight: FontWeight.w500),
        ),
      ),
    );
  }
}

class _CarbCard extends StatefulWidget {
  const _CarbCard({
    required this.id,
    required this.active,
    required this.targetCalories,
    required this.onTap,
  });

  final String id;
  final bool active;
  final double targetCalories;
  final VoidCallback onTap;

  @override
  State<_CarbCard> createState() => _CarbCardState();
}

class _CarbCardState extends State<_CarbCard> {
  bool _pressed = false;

  String get _label => switch (widget.id) {
    'moderate_carb' => tr('onboarding.bodyMetrics.moderateCarb'),
    'lower_carb' => tr('onboarding.bodyMetrics.lowerCarb'),
    _ => tr('onboarding.bodyMetrics.higherCarb'),
  };

  String get _desc => switch (widget.id) {
    'moderate_carb' => tr('onboarding.bodyMetrics.moderateCarbDescription'),
    'lower_carb' => tr('onboarding.bodyMetrics.lowerCarbDescription'),
    _ => tr('onboarding.bodyMetrics.higherCarbDescription'),
  };

  @override
  Widget build(BuildContext context) {
    final macros = calcMacroGrams(
      widget.targetCalories,
      carbSplitFromString(widget.id),
    );
    final active = widget.active;
    final grams = tr('onboarding.bodyMetrics.grams');
    final rows = <(String, num)>[
      (tr('onboarding.bodyMetrics.protein'), macros.proteinG.round()),
      (tr('onboarding.bodyMetrics.fat'), macros.fatG.round()),
      (tr('onboarding.bodyMetrics.carbs'), macros.carbsG.round()),
    ];

    final borderColor =
        active
            ? NhamColors.text.withValues(alpha: 0.3)
            : (_pressed ? NhamColors.accent50 : NhamColors.inputBorder);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: active ? NhamColors.hover : NhamColors.elev,
          borderRadius: BorderRadius.circular(NhamRadii.xxxl), // rounded-[22px]
          border: Border.all(color: borderColor),
          boxShadow:
              active
                  ? const [
                    // shadow-[0_10px_24px_rgba(201,168,124,0.14)]
                    BoxShadow(
                      color: Color(0x24C9A87C),
                      blurRadius: 24,
                      offset: Offset(0, 10),
                    ),
                  ]
                  : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header band (px-3.5 py-2.5).
            Container(
              color:
                  active
                      ? NhamColors
                          .selectedSegment // #FBF2E6
                      : NhamColors.track, // #F5F4F0
              padding: const EdgeInsets.symmetric(
                horizontal: NhamSpacing.sp3_5, // px-3.5
                vertical: NhamSpacing.sp2_5, // py-2.5
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _label,
                    style: dashBody(weight: FontWeight.w500),
                  ),
                  const SizedBox(height: 2), // mt-0.5
                  Text(
                    _desc,
                    style: dashMeta(),
                  ),
                ],
              ),
            ),
            // Body (px-3.5 py-3) — stacked P/F/C rows (space-y-1.5).
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: NhamSpacing.sp3_5,
                vertical: NhamSpacing.sp3,
              ),
              child: Column(
                children: [
                  for (var i = 0; i < rows.length; i++) ...[
                    if (i > 0) const SizedBox(height: NhamSpacing.sp1_5),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          rows[i].$1.toUpperCase(),
                          style: dashEyebrow(),
                        ),
                        Text(
                          '${rows[i].$2}$grams',
                          style: dashBody(
                            weight: FontWeight.w500,
                            tabular: true,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
