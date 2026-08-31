import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/kallo_colors.dart';
import '../../logic/logging_spacing.dart';

/// "Save this analysis" — the beige confirm circle at the right end of the
/// staged card's action row (the Log artboard).
///
/// It replaced a full-width umber "✓ Confirm" pill in the native pass. Every
/// other card in the feed answers with a row of 44pt icon targets under it, and
/// the pill made the one card awaiting confirmation shout twice its neighbours'
/// weight. Beige (`btnPrimarySoft`) is the app's in-app primary wash, so the
/// affordance still reads as the one thing to do on this card; the label lives
/// in the semantics and the tooltip rather than beside the glyph.
class MealEntryConfirmButton extends StatefulWidget {
  const MealEntryConfirmButton({
    super.key,
    required this.editing,
    required this.disabled,
    required this.onTap,
  });

  /// While the amounts are open the circle goes quiet (track fill, muted
  /// check): saving is still possible, but adjusting is what the user came
  /// here to do.
  final bool editing;
  final bool disabled;
  final VoidCallback? onTap;

  @override
  State<MealEntryConfirmButton> createState() => _MealEntryConfirmButtonState();
}

class _MealEntryConfirmButtonState extends State<MealEntryConfirmButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // [disabled] used to do nothing but dim the button: it drove the 50%
    // opacity and left every callback live. The one caller nulls [onTap]
    // itself, so nothing was reachable — but a widget whose `disabled` flag
    // does not disable is a trap for the next caller, and this one submits a
    // meal.
    final tappable = !widget.disabled && widget.onTap != null;
    final quiet = widget.editing;
    final Color fill = quiet ? KalloColors.track : KalloColors.btnPrimarySoft;
    final Color fg = quiet ? KalloColors.textMuted : KalloColors.text;

    return Tooltip(
      message: 'logging.confirm'.tr(),
      excludeFromSemantics: true,
      child: Semantics(
        button: true,
        enabled: tappable,
        excludeSemantics: true,
        label: 'logging.confirm'.tr(),
        onTap: tappable ? widget.onTap : null,
        child: Opacity(
          opacity: widget.disabled ? 0.5 : 1,
          child: GestureDetector(
            onTapDown: tappable ? (_) => setState(() => _pressed = true) : null,
            onTapUp: tappable ? (_) => setState(() => _pressed = false) : null,
            onTapCancel:
                tappable ? () => setState(() => _pressed = false) : null,
            onTap: tappable ? widget.onTap : null,
            // 32pt visual centred in the action row's 44pt target.
            child: SizedBox.square(
              dimension: LoggingIcons.hit,
              child: Center(
                child: AnimatedScale(
                  scale: _pressed && tappable ? 0.95 : 1,
                  duration: const Duration(milliseconds: 150),
                  child: Container(
                    width: LoggingIcons.wash,
                    height: LoggingIcons.wash,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
                    child: Icon(LucideIcons.check400, size: 18, color: fg),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
