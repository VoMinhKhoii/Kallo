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

/// The cheat-meal intensity picker as a grouped disclosure row — "Intensity …
/// Medium ›" — sitting under the mode list in the meal-mode sheet.
///
/// It replaces the segmented strip that used to ride above the composer: the
/// magnitude belongs to the mode that owns it, so it is set where the mode is
/// chosen and read back from the composer's mode pill. Tapping the row expands
/// the three levels in place rather than stacking a second sheet on the first.
class CheatIntensityGroup extends StatefulWidget {
  const CheatIntensityGroup({
    super.key,
    required this.value,
    required this.onChange,
  });

  final CheatIntensity value;
  final ValueChanged<CheatIntensity> onChange;

  @override
  State<CheatIntensityGroup> createState() => _CheatIntensityGroupState();
}

class _CheatIntensityGroupState extends State<CheatIntensityGroup> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return GroupedListCard(
      // Text-only rows: the hairline runs the full width of the card.
      separatorInset: 0,
      children: [
        ListRow(
          label: 'logging.cheatIntensity.title'.tr(),
          value: cheatIntensityLabel(widget.value),
          onTap: () => setState(() => _expanded = !_expanded),
          // The chevron turns down while the levels are open — a disclosure
          // that expands in place must not keep pointing off to a page.
          trailing: AnimatedRotation(
            turns: _expanded ? 0.25 : 0,
            duration: const Duration(milliseconds: 200),
            child: const Icon(
              LucideIcons.chevronRight300,
              size: KalloIcons.tertiary,
              color: kInkMuted,
            ),
          ),
        ),
        if (_expanded)
          for (final intensity in CheatIntensity.values)
            ListRow(
              label: cheatIntensityLabel(intensity),
              onTap: () {
                HapticFeedback.selectionClick();
                widget.onChange(intensity);
                setState(() => _expanded = false);
              },
              trailing: intensity == widget.value
                  ? const Icon(
                      LucideIcons.check300,
                      size: KalloIcons.size,
                      color: KalloColors.text,
                    )
                  : null,
            ),
      ],
    );
  }
}

/// The localized name of an intensity level — shared by the picker rows, the
/// disclosure row's value and the composer's mode pill.
String cheatIntensityLabel(CheatIntensity intensity) =>
    'logging.cheatIntensity.${intensity.name}'.tr();
