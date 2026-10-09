import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/format.dart';
import '../macros/macro_trio.dart';
import 'picker_styles.dart';

/// One row on the picker band: a [title], a [subtitle] under it, and a kcal
/// figure at the right. The `/` picker's subtitle is the macro split; cheat
/// mode's is when you last had it — either way, what you are about to log is
/// legible before you commit to it.
///
/// The web fits name, subtitle and kcal on ONE line; a phone does not, and
/// squeezing them would ellipsize the name — which is the one thing the row
/// exists to show. The subtitle takes a second line instead.
class PickerOption extends StatefulWidget {
  const PickerOption({
    super.key,
    required this.title,
    required this.subtitle,
    required this.kcal,
    required this.onSelect,
    this.enabled = true,
  });

  final String title;
  final String subtitle;

  /// Unknown renders as an em dash, never as zero.
  final double? kcal;
  final VoidCallback onSelect;

  /// False while the band's last pick is still being staged: dimmed, inert.
  final bool enabled;

  @override
  State<PickerOption> createState() => _PickerOptionState();
}

class _PickerOptionState extends State<PickerOption> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.enabled;
    return Semantics(
      button: true,
      enabled: enabled,
      child: Opacity(
        opacity: enabled ? 1 : 0.5,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: enabled ? (_) => _setPressed(true) : null,
          onTapUp: enabled ? (_) => _setPressed(false) : null,
          onTapCancel: enabled ? () => _setPressed(false) : null,
          onTap:
              enabled
                  ? () {
                    HapticFeedback.selectionClick();
                    widget.onSelect();
                  }
                  : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            decoration: BoxDecoration(
              // The band is INK, so the press lightens rather than warms. The
              // warm hover wash is lighter than the canvas but darker than
              // nothing on this surface — on the band it would barely move.
              color: _pressed ? KalloColors.pressWashOnInk : Colors.transparent,
              borderRadius: BorderRadius.circular(KalloRadii.md),
            ),
            padding: const EdgeInsets.all(KalloSpacing.sp2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: PickerStyles.body,
                      ),
                      Text(widget.subtitle, style: PickerStyles.metaTabular),
                    ],
                  ),
                ),
                const SizedBox(width: KalloSpacing.sp2),
                _kcal(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // A FIXED cell, not a flexible one. Flexible sizes to content, so `137 kcal`
  // and `1024 kcal` claim different widths and the column goes ragged down the
  // list — the same defect the meal card's trio was fixed for. The fixed width
  // also bounds the row: a Row lays its non-flex children out first, so an
  // unbounded kcal at a large text scale would take the whole width and leave
  // the name none.
  Widget _kcal(BuildContext context) {
    return SizedBox(
      width: MacroTrio.kcalColumn,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerRight,
        child: Text(
          'logging.relog.optionKcal'.tr(
            namedArgs: {
              'kcal': fmtKcalValue(widget.kcal, locale: localeOf(context)),
            },
          ),
          maxLines: 1,
          softWrap: false,
          style: PickerStyles.metaTabular,
        ),
      ),
    );
  }
}
