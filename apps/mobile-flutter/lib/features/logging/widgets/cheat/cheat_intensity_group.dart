import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../shared/widgets/list/list_row.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// The cheat-meal intensity row — "Intensity … Medium ›" — sitting under the
/// mode list in the meal-mode sheet.
///
/// A disclosure that PUSHES, not one that expands: tapping it hands the sheet
/// [onOpen] and the sheet swaps in [CheatIntensityPage]. Expanding in place
/// grew the card by three rows in a single frame and left the chosen level and
/// the row that names it visible at the same time, saying the same thing
/// twice. The chevron points off to a page again because it now goes to one.
class CheatIntensityGroup extends StatelessWidget {
  const CheatIntensityGroup({
    super.key,
    required this.value,
    required this.onOpen,
  });

  final CheatIntensity value;

  /// Opens the second-level page. The sheet owns that navigation.
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return GroupedListCard(
      // Text-only rows: the hairline runs the full width of the card.
      separatorInset: 0,
      children: [
        ListRow(
          label: 'logging.cheatIntensity.title'.tr(),
          value: cheatIntensityLabel(value),
          onTap: onOpen,
          trailing: const Icon(
            LucideIcons.chevronRight300,
            size: KalloIcons.tertiary,
            color: kInkMuted,
          ),
        ),
      ],
    );
  }
}

/// The second level: the three levels as one grouped card, a tick on the
/// current one, and a muted line under the card saying what the choice does.
///
/// No fill behind the chosen row — the tick is the whole signal, which is the
/// pattern every other single-select list in a sheet now follows.
class CheatIntensityPage extends StatelessWidget {
  const CheatIntensityPage({
    super.key,
    required this.value,
    required this.onChange,
  });

  final CheatIntensity value;

  /// Fired with the picked level; the sheet applies it and pops back.
  final ValueChanged<CheatIntensity> onChange;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GroupedListCard(
          separatorInset: 0,
          children: [
            for (final intensity in CheatIntensity.values)
              ListRow(
                label: cheatIntensityLabel(intensity),
                onTap: () {
                  HapticFeedback.selectionClick();
                  onChange(intensity);
                },
                trailing: intensity == value
                    ? const Icon(
                        LucideIcons.check300,
                        size: KalloIcons.size,
                        color: KalloColors.text,
                      )
                    : null,
              ),
          ],
        ),
        Padding(
          // Hangs off the card on the card's own text inset, the way a
          // grouped-list footnote does.
          padding: const EdgeInsets.fromLTRB(
            KalloSpacing.sp4,
            KalloSpacing.sp2,
            KalloSpacing.sp4,
            0,
          ),
          child: Text(
            'logging.cheatIntensity.helper'.tr(),
            style: dashMeta(),
          ),
        ),
      ],
    );
  }
}

/// The localized name of an intensity level — shared by the picker rows, the
/// disclosure row's value and the composer's mode pill.
String cheatIntensityLabel(CheatIntensity intensity) =>
    'logging.cheatIntensity.${intensity.name}'.tr();
