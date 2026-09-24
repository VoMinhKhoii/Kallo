import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/profile/onboarding.dart';
import '../../../shared/data/portion_assets.dart';
import '../../../shared/widgets/form/option_row.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_answers.dart';
import '../logic/onboarding_step_spec.dart';

/// One cooking question: its group label, its options' l10n keys (each
/// option's hint is the same key + `Hint`), the portion drawings its rows
/// carry if any, and the two accessors that read and write the answer on
/// [CookingHabits]. The options come off the ENUM rather than being spelled
/// out again, so no second copy of the value sets can drift from the payload
/// the server accepts.
typedef CookingHabit =
    ({
      String label,
      List<Enum> values,
      List<String> optionLabels,
      List<String>? pictures,
      Enum Function(CookingHabits) read,
      CookingHabits Function(CookingHabits, Enum) write,
    });

/// Screen 5 — "Your cooking habits": four questions, every one opening on its
/// middle answer. It is a calibration, not an interview.
///
/// Each answer is an [OptionRow] with its hint showing (2026-09-24). The four
/// segmented strips this replaced were compact, but a bare "Ít | Vừa | Nhiều"
/// hid what "Vừa" meant — and this screen is also the Settings page people
/// open to check exactly that. The rice and protein rows carry the portion
/// picker's own drawings on the trailing edge, growing with the portion, so
/// "a palm-sized piece" is something you see, not parse.
class StepCooking extends StatelessWidget {
  const StepCooking({
    super.key,
    required this.answers,
    required this.onChanged,
  });

  final OnboardingAnswers answers;
  final VoidCallback onChanged;

  static final List<CookingHabit> habits = [
    (
      label: 'onboarding.cooking.stepLabels.oil',
      values: OilUsage.values,
      optionLabels: const [
        'onboarding.cooking.oilMinimal',
        'onboarding.cooking.oilNormal',
        'onboarding.cooking.oilHeavy',
      ],
      pictures: null,
      read: (c) => c.oilUsage,
      write: (c, v) => c.copyWith(oilUsage: v as OilUsage),
    ),
    (
      label: 'onboarding.cooking.stepLabels.rice',
      values: RicePortion.values,
      optionLabels: const [
        'onboarding.cooking.riceSmall',
        'onboarding.cooking.riceMedium',
        'onboarding.cooking.riceLarge',
      ],
      pictures: const [
        'bowl-1-chen.webp',
        'bowl-2-medium.webp',
        'bowl-3-large-to.webp',
      ],
      read: (c) => c.defaultRicePortion,
      write: (c, v) => c.copyWith(defaultRicePortion: v as RicePortion),
    ),
    (
      label: 'onboarding.cooking.stepLabels.protein',
      values: ProteinPortion.values,
      optionLabels: const [
        'onboarding.cooking.proteinSmall',
        'onboarding.cooking.proteinMedium',
        'onboarding.cooking.proteinLarge',
      ],
      pictures: const [
        'meat-2-belly-slices.webp',
        'meat-3-chop.webp',
        'poultry-5-quarter.webp',
      ],
      read: (c) => c.defaultProteinPortion,
      write: (c, v) => c.copyWith(defaultProteinPortion: v as ProteinPortion),
    ),
    (
      label: 'onboarding.cooking.stepLabels.broth',
      values: BrothConsumption.values,
      optionLabels: const [
        'onboarding.cooking.brothLeave',
        'onboarding.cooking.brothSome',
        'onboarding.cooking.brothFinish',
      ],
      pictures: null,
      read: (c) => c.brothConsumption,
      write: (c, v) => c.copyWith(brothConsumption: v as BrothConsumption),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final habit in habits) ...[
          if (habit != habits.first) const SizedBox(height: KalloSpacing.sp6),
          GroupLabel(tr(habit.label)),
          for (var i = 0; i < habit.values.length; i++) ...[
            const SizedBox(height: KalloSpacing.sp3),
            OptionRow(
              label: tr(habit.optionLabels[i]),
              subline: tr('${habit.optionLabels[i]}Hint'),
              selected: habit.read(answers.cooking) == habit.values[i],
              trailing:
                  habit.pictures == null
                      ? null
                      : PortionPicture(file: habit.pictures![i], rank: i),
              onTap: () {
                answers.cooking = habit.write(answers.cooking, habit.values[i]);
                onChanged();
              },
            ),
          ],
        ],
      ],
    );
  }
}

/// A portion drawing on the trailing edge of a cooking row, right-aligned in
/// a fixed box so the three rows' text columns line up. It GROWS with the
/// answer ([rank] 0–2) — the size step is the point of the picture, so it
/// is never scaled to fill.
class PortionPicture extends StatelessWidget {
  const PortionPicture({super.key, required this.file, required this.rank});

  final String file;
  final int rank;

  static const double width = 72, height = 48;

  /// Drawing height per rank: small, medium, large.
  static const List<double> _heights = [30, 40, 48];

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    height: height,
    child: Align(
      alignment: Alignment.centerRight,
      child: Image.asset(
        '$portionAssetDir/$file',
        height: _heights[rank.clamp(0, _heights.length - 1)],
        fit: BoxFit.contain,
      ),
    ),
  );
}

/// Screen 5's contract.
OnboardingStepSpec stepCookingSpec({
  required OnboardingAnswers answers,
  required VoidCallback onChanged,
}) => (
  title: tr('onboarding.cooking.title'),
  body: StepCooking(answers: answers, onChanged: onChanged),
  ctaLabel: tr('onboarding.continueLabel'),
  ctaEnabled: true,
);
