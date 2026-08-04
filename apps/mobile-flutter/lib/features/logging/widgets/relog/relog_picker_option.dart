import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/relog.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/format.dart';
import '../macro_trio.dart';

/// One row of the `/` picker. Dishes and meals share this layout — the subtitle
/// is the macro split either way, so what you are about to log is visible
/// before you commit to it.
///
/// The web fits name, macro split and kcal on ONE line; a phone does not, and
/// squeezing them would ellipsize the dish name — which is the one thing the
/// row exists to show. The split moves to a second line at Meta 12, matching
/// the manual-log sheet's result tile.
class RelogPickerOption extends StatefulWidget {
  const RelogPickerOption({
    super.key,
    required this.candidate,
    required this.onSelect,
  });

  final RelogCandidate candidate;
  final VoidCallback onSelect;

  @override
  State<RelogPickerOption> createState() => _RelogPickerOptionState();
}

class _RelogPickerOptionState extends State<RelogPickerOption> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.candidate.summary;
    final macroSplit = 'logging.relog.macroSplit'.tr(
      namedArgs: {
        'protein': fmtMacroValue(summary.proteinG),
        'carbs': fmtMacroValue(summary.carbohydrateG),
        'fat': fmtMacroValue(summary.fatG),
      },
    );

    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _setPressed(true),
        onTapUp: (_) => _setPressed(false),
        onTapCancel: () => _setPressed(false),
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onSelect();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          decoration: BoxDecoration(
            // The popup is an INK band, so the press lightens rather than
            // warms. The warm hover wash is lighter than the canvas but darker
            // than nothing on this surface — on the band it would barely move.
            color: _pressed ? NhamColors.pressWashOnInk : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.md),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp2,
            vertical: NhamSpacing.sp2,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Both lines full white on the band, exactly as the notice
                    // pairs its title and body: hierarchy comes from size and
                    // weight, never opacity, because translucent white here
                    // drops the smaller line below 4.5:1.
                    Text(
                      widget.candidate.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: dashBody(
                        color: NhamColors.bandForeground,
                        weight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      macroSplit,
                      style: dashMeta(
                        color: NhamColors.bandForeground,
                        tabular: true,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: NhamSpacing.sp2),
              // A FIXED cell, not a flexible one. Flexible sizes to content,
              // so `137 kcal` and `1024 kcal` claim different widths and the
              // column goes ragged down the list — the same defect the meal
              // card's trio was just fixed for. The fixed width also bounds the
              // row: a Row lays its non-flex children out first, so an
              // unbounded kcal at a large text scale would take the whole width
              // and leave the dish name none.
              SizedBox(
                width: MacroTrio.kcalColumn,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Text(
                    'logging.relog.optionKcal'.tr(
                      namedArgs: {'kcal': fmtKcalValue(summary.caloriesKcal)},
                    ),
                    maxLines: 1,
                    softWrap: false,
                    style: dashMeta(
                      color: NhamColors.bandForeground,
                      tabular: true,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
