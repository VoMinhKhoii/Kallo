import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/onboarding.dart';
import '../../../shared/widgets/decimal_input.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../controls/aggression_slider.dart';
import '../controls/custom_select.dart';
import '../logic/tdee.dart';
import '../widgets/profile_form_controller.dart';
import '../widgets/profile_form_values.dart';

const _goals = [Goal.cutting, Goal.maintaining, Goal.bulking];
const _carbSplits = [
  CarbSplit.moderateCarb,
  CarbSplit.lowerCarb,
  CarbSplit.higherCarb,
];

/// RN port of web `components/settings/profile/body-metrics.tsx`.
class BodyMetrics extends StatelessWidget {
  const BodyMetrics({super.key});

  @override
  Widget build(BuildContext context) {
    final form = ProfileFormController.of(context);
    final v = form.values;
    String t(String k) => tr('onboarding.bodyMetrics.$k');

    // Live TDEE / targets — recomputed on every form mutation (the controller
    // notifies, the screen rebuilds this panel). Matches RN useWatch + useMemo.
    final allMetricsFilled = v.weightKg != null &&
        !(v.weightKg!.isNaN) &&
        v.heightCm != null &&
        v.age != null;

    int? tdee;
    if (allMetricsFilled) {
      final bmr = calcBMR(
        biologicalSex: v.biologicalSex,
        weightKg: v.weightKg!,
        heightCm: v.heightCm!,
        age: v.age!,
      );
      tdee = calcTDEE(bmr, v.activityLevel);
    }

    final targetCalories = tdee == null
        ? 0.0
        : calcDailyTargets(tdee, v.goal, v.aggression, v.carbSplit).calories;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Body metrics group ──────────────────────────────────────────
        _Group(
          children: [
            _Field(
              label: t('biologicalSex'),
              child: CustomSelect(
                value: v.biologicalSex.name,
                onChange: (s) => form.update(
                    (f) => f.biologicalSex = BiologicalSex.values.byName(s)),
                options: [
                  CustomSelectOption(value: 'male', label: t('male')),
                  CustomSelectOption(value: 'female', label: t('female')),
                ],
              ),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _Field(
                    label: '${t('weight')} (${t('weightUnit')})',
                    child: _NumberField(
                      hint: '65',
                      value: v.weightKg,
                      onChange: (d) {
                        form.update((f) => f.weightKg = d);
                        form.clearError(ProfileField.weightKg);
                      },
                      error: form.errorFor(ProfileField.weightKg),
                    ),
                  ),
                ),
                const SizedBox(width: NhamSpacing.sp4),
                Expanded(
                  child: _Field(
                    label: '${t('height')} (${t('heightUnit')})',
                    child: _NumberField(
                      hint: '170',
                      integer: true,
                      value: v.heightCm?.toDouble(),
                      onChange: (d) {
                        form.update((f) => f.heightCm = d?.toInt());
                        form.clearError(ProfileField.heightCm);
                      },
                      error: form.errorFor(ProfileField.heightCm),
                    ),
                  ),
                ),
              ],
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _Field(
                    label: t('age'),
                    child: _NumberField(
                      hint: '25',
                      integer: true,
                      value: v.age?.toDouble(),
                      onChange: (d) {
                        form.update((f) => f.age = d?.toInt());
                        form.clearError(ProfileField.age);
                      },
                      error: form.errorFor(ProfileField.age),
                    ),
                  ),
                ),
                const SizedBox(width: NhamSpacing.sp4),
                const Expanded(child: SizedBox.shrink()),
              ],
            ),
            _Field(
              label: t('activityLevel'),
              child: CustomSelect(
                value: activityLevelToString(v.activityLevel),
                onChange: (s) =>
                    form.update((f) => f.activityLevel = _activityFrom(s)),
                options: [
                  CustomSelectOption(value: 'sedentary', label: t('sedentary')),
                  CustomSelectOption(value: 'light', label: t('light')),
                  CustomSelectOption(value: 'moderate', label: t('moderate')),
                  CustomSelectOption(value: 'very_active', label: t('veryActive')),
                ],
              ),
            ),
          ],
        ),

        // ── Goal → pace → split → target (gated on a computed TDEE) ─────
        if (tdee != null) ...[
          const SizedBox(height: NhamSpacing.sp8),
          Container(
            padding: const EdgeInsets.only(top: NhamSpacing.sp6),
            decoration: const Border(
              top: BorderSide(color: NhamColors.inputBorder),
            ).toDecoration(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _GoalSegments(form: form),
                if (v.goal != Goal.maintaining) ...[
                  const SizedBox(height: NhamSpacing.sp8),
                  _AggressionField(form: form),
                ],
                const SizedBox(height: NhamSpacing.sp8),
                _CarbSplitField(form: form, targetCalories: targetCalories),
                const SizedBox(height: NhamSpacing.sp8),
                _HeroTarget(
                  tdee: tdee,
                  targetCalories: targetCalories,
                  goal: v.goal,
                  macros: calcMacroGrams(targetCalories, v.carbSplit),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

ActivityLevel _activityFrom(String s) => switch (s) {
      'sedentary' => ActivityLevel.sedentary,
      'light' => ActivityLevel.light,
      'moderate' => ActivityLevel.moderate,
      'very_active' => ActivityLevel.veryActive,
      _ => ActivityLevel.light,
    };

// ── Shared building blocks ───────────────────────────────────────────────

class _Group extends StatelessWidget {
  const _Group({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const SizedBox(height: NhamSpacing.sp4),
          children[i],
        ],
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FieldLabel(label),
        const SizedBox(height: 6), // gap-1.5
        child,
      ],
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    // Web: font-bold text-[11px] uppercase tracking-widest (0.1em ≈ 1.1px at
    // 11px) text-[#6B5D4F].
    return Text(
      text.toUpperCase(),
      style: NhamTextStyles.sansBold(fontSize: NhamFontSize.xxs)
          .copyWith(letterSpacing: 1.1, color: NhamColors.textSoft),
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({
    required this.hint,
    required this.value,
    required this.onChange,
    this.integer = false,
    this.error,
  });

  final String hint;
  final double? value;
  final ValueChanged<double?> onChange;
  final bool integer;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DecimalInput(
          value: value,
          onValueChange: onChange,
          integer: integer,
          hintText: hint,
        ),
        if (error != null) ...[
          const SizedBox(height: 6), // gap-1.5
          Text(
            error!,
            style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xs)
                .copyWith(color: NhamColors.danger),
          ),
        ],
      ],
    );
  }
}

// ── Goal segmented control ───────────────────────────────────────────────

class _GoalSegments extends StatelessWidget {
  const _GoalSegments({required this.form});
  final ProfileFormController form;

  @override
  Widget build(BuildContext context) {
    String t(String k) => tr('onboarding.bodyMetrics.$k');
    final goalLabel = {
      Goal.maintaining: t('maintaining'),
      Goal.cutting: t('cutting'),
      Goal.bulking: t('bulking'),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FieldLabel(t('goal')),
        const SizedBox(height: NhamSpacing.sp2),
        Container(
          padding: const EdgeInsets.all(NhamSpacing.sp1),
          decoration: BoxDecoration(
            color: NhamColors.inputBorder40,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          child: Row(
            children: [
              for (var i = 0; i < _goals.length; i++) ...[
                if (i > 0) const SizedBox(width: NhamSpacing.sp1),
                Expanded(
                  child: _SegmentButton(
                    label: goalLabel[_goals[i]]!,
                    active: form.values.goal == _goals[i],
                    onTap: () => form.setGoal(_goals[i]),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _SegmentButton extends StatefulWidget {
  const _SegmentButton({
    required this.label,
    required this.active,
    required this.onTap,
  });
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_SegmentButton> createState() => _SegmentButtonState();
}

class _SegmentButtonState extends State<_SegmentButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // Inactive `hover:text-[#2C2416]` — text darkens to `text` on press.
    final color = widget.active || _pressed
        ? NhamColors.text
        : NhamColors.textWarm;
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150), // transition-all
        alignment: Alignment.center,
        // px-2 py-2
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp2,
          vertical: NhamSpacing.sp2,
        ),
        decoration: BoxDecoration(
          color: widget.active ? NhamColors.elev : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.md), // rounded-lg = 8
          boxShadow: widget.active ? const [NhamShadows.sm] : null,
        ),
        child: Text(
          widget.label,
          textAlign: TextAlign.center,
          style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
              .copyWith(color: color),
        ),
      ),
    );
  }
}

// ── Aggression ───────────────────────────────────────────────────────────

class _AggressionField extends StatelessWidget {
  const _AggressionField({required this.form});
  final ProfileFormController form;

  @override
  Widget build(BuildContext context) {
    String t(String k) => tr('onboarding.bodyMetrics.$k');
    final isCutting = form.values.goal == Goal.cutting;
    final label = '${t('aggressionLabel')} '
        '(${isCutting ? t('aggressionDeficit') : t('aggressionSurplus')})';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FieldLabel(label),
        const SizedBox(height: NhamSpacing.sp2),
        AggressionSlider(
          value: form.values.aggression,
          onChange: (d) => form.update((f) => f.aggression = d),
          isCutting: isCutting,
        ),
      ],
    );
  }
}

// ── Carb split cards ─────────────────────────────────────────────────────

class _CarbSplitField extends StatelessWidget {
  const _CarbSplitField({required this.form, required this.targetCalories});
  final ProfileFormController form;
  final double targetCalories;

  @override
  Widget build(BuildContext context) {
    String t(String k) => tr('onboarding.bodyMetrics.$k');
    final info = {
      CarbSplit.moderateCarb:
          (label: t('moderateCarb'), desc: t('moderateCarbDescription')),
      CarbSplit.lowerCarb:
          (label: t('lowerCarb'), desc: t('lowerCarbDescription')),
      CarbSplit.higherCarb:
          (label: t('higherCarb'), desc: t('higherCarbDescription')),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FieldLabel(t('carbSplit')),
        const SizedBox(height: NhamSpacing.sp2),
        for (var i = 0; i < _carbSplits.length; i++) ...[
          if (i > 0) const SizedBox(height: NhamSpacing.sp3),
          _CarbCard(
            label: info[_carbSplits[i]]!.label,
            desc: info[_carbSplits[i]]!.desc,
            macros: calcMacroGrams(targetCalories, _carbSplits[i]),
            active: form.values.carbSplit == _carbSplits[i],
            onTap: () => form.update((f) => f.carbSplit = _carbSplits[i]),
          ),
        ],
      ],
    );
  }
}

class _CarbCard extends StatefulWidget {
  const _CarbCard({
    required this.label,
    required this.desc,
    required this.macros,
    required this.active,
    required this.onTap,
  });
  final String label;
  final String desc;
  final MacroTargets macros;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_CarbCard> createState() => _CarbCardState();
}

class _CarbCardState extends State<_CarbCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // Unselected `hover:border-[#C9A87C]/50` — border lightens to accent50 on
    // press; selected keeps the solid accent border + shadow-sm.
    final borderColor = widget.active
        ? NhamColors.accent
        : (_pressed ? NhamColors.accent50 : NhamColors.inputBorder);
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150), // transition-all
        padding: const EdgeInsets.all(NhamSpacing.sp4),
        decoration: BoxDecoration(
          color: widget.active ? NhamColors.accent05 : NhamColors.elev,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          border: Border.all(color: borderColor),
          boxShadow: widget.active ? const [NhamShadows.sm] : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.label,
              style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
                  .copyWith(color: NhamColors.text),
            ),
            const SizedBox(height: NhamSpacing.sp1),
            Text(
              widget.desc,
              style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xxs)
                  .copyWith(color: NhamColors.textWarm),
            ),
            // gap-1 + mt-1 → ~8px above the macros row.
            const SizedBox(height: NhamSpacing.sp2),
            Row(
              children: [
                _macro('P ${widget.macros.proteinG.round()}g'),
                const SizedBox(width: NhamSpacing.sp3),
                _macro('C ${widget.macros.carbsG.round()}g'),
                const SizedBox(width: NhamSpacing.sp3),
                _macro('F ${widget.macros.fatG.round()}g'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _macro(String s) => Text(
        s,
        style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xxs)
            .copyWith(color: NhamColors.textWarm),
      );
}

// ── Hero target card ─────────────────────────────────────────────────────

class _HeroTarget extends StatelessWidget {
  const _HeroTarget({
    required this.tdee,
    required this.targetCalories,
    required this.goal,
    required this.macros,
  });
  final int tdee;
  final double targetCalories;
  final Goal goal;
  final MacroTargets macros;

  @override
  Widget build(BuildContext context) {
    String t(String k) => tr('onboarding.bodyMetrics.$k');
    final calories = targetCalories.round();
    final delta = (tdee - calories).abs();
    final isCutting = goal == Goal.cutting;

    final subtitle = StringBuffer()
      ..write('${t('basedOnTdee')} ~${_grouped(tdee)} ${t('kcal')}');
    if (goal == Goal.maintaining) {
      subtitle.write(' · ${t('maintenance')}');
    } else {
      subtitle.write(' · ${isCutting ? '−' : '+'}${_grouped(delta)} '
          '${t('perDay')} '
          '${isCutting ? t('aggressionDeficit') : t('aggressionSurplus')}');
    }

    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp5),
      decoration: BoxDecoration(
        color: NhamColors.accent07,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.accent40),
      ),
      child: Column(
        children: [
          _FieldLabel(t('calorieTarget')),
          const SizedBox(height: NhamSpacing.sp1),
          Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                _grouped(calories),
                style: NhamTextStyles.serifRegular(fontSize: 36, height: 44 / 36)
                    // tracking-tighter = -0.05em ≈ -1.8px at 36px
                    .copyWith(letterSpacing: -1.8, color: NhamColors.text),
              ),
              Text(
                ' ${t('kcal')}',
                style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.lg)
                    .copyWith(color: NhamColors.textWarm),
              ),
            ],
          ),
          const SizedBox(height: 6), // mt-1.5
          Text(
            subtitle.toString(),
            textAlign: TextAlign.center,
            style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xs)
                .copyWith(color: NhamColors.textWarm),
          ),
          const SizedBox(height: NhamSpacing.sp5),
          Container(
            padding: const EdgeInsets.only(top: NhamSpacing.sp4),
            decoration: const Border(
              top: BorderSide(color: NhamColors.accent20),
            ).toDecoration(),
            child: Row(
              children: [
                _macroCol(t('protein'), macros.proteinG.round()),
                _macroCol(t('carbs'), macros.carbsG.round()),
                _macroCol(t('fat'), macros.fatG.round()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _macroCol(String label, int grams) => Expanded(
        child: Column(
          children: [
            Text(
              label.toUpperCase(),
              // tracking-widest = 0.1em ≈ 1.0px at 10px
              style: NhamTextStyles.sansBold(fontSize: NhamFontSize.eyebrow)
                  .copyWith(letterSpacing: 1.0, color: NhamColors.textSoft),
            ),
            const SizedBox(height: 2), // gap-0.5
            Text(
              '${grams}g',
              style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.lg)
                  .copyWith(color: NhamColors.text),
            ),
          ],
        ),
      );
}

/// Groups an integer with thousands separators (RN `.toLocaleString()`).
String _grouped(int n) {
  final s = n.abs().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return n < 0 ? '-$buf' : buf.toString();
}

extension on Border {
  BoxDecoration toDecoration() => BoxDecoration(border: this);
}
