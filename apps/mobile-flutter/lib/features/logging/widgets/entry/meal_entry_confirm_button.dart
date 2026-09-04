import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../logic/logging_spacing.dart';
import '../composer/entrances.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';

/// "Save meal" — the FULL-WIDTH confirm pill under the staged card.
///
/// The native pass shrank this to a 32pt beige circle in the card's action row.
/// That reads as one more icon target among the discard trash and its
/// neighbours, when it is the single thing the card exists to ask for: a
/// staged analysis is not saved until this is tapped. A full-width pill is the
/// app's shape for "the one action here", and the label says what it does
/// instead of leaving it to a tooltip nobody sees on a phone.
///
/// Beige (`btnPrimarySoft`) + ink is the in-app primary wash — black is
/// reserved for auth and paywall CTAs.
class MealEntryConfirmButton extends StatefulWidget {
  const MealEntryConfirmButton({
    super.key,
    required this.editing,
    required this.disabled,
    required this.onTap,
  });

  /// While the amounts are open the pill goes quiet (track fill, muted label):
  /// saving is still possible, but adjusting is what the user came here to do.
  final bool editing;
  final bool disabled;
  final VoidCallback? onTap;

  @override
  State<MealEntryConfirmButton> createState() => _MealEntryConfirmButtonState();
}

class _MealEntryConfirmButtonState extends State<MealEntryConfirmButton> {
  bool _pressed = false;

  /// The app's primary height, as on every other full-width pill.
  static const double _height = 50;

  @override
  Widget build(BuildContext context) {
    // [disabled] used to do nothing but dim the button: it drove the 50%
    // opacity and left every callback live. The one caller nulls [onTap]
    // itself, so nothing was reachable — but a widget whose `disabled` flag
    // does not disable is a trap for the next caller, and this one submits a
    // meal.
    final tappable = !widget.disabled && widget.onTap != null;
    final quiet = widget.editing;

    final Color base = quiet ? KalloColors.track : KalloColors.btnPrimarySoft;
    // Press is a background colour-shift, not an opacity dim — as on
    // [KalloButton].
    final Color fill = _pressed && tappable
        ? Color.alphaBlend(KalloColors.pressWash, base)
        : base;
    final Color fg = quiet ? KalloColors.textMuted : KalloColors.text;

    return Semantics(
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
          onTapCancel: tappable ? () => setState(() => _pressed = false) : null,
          onTap: tappable ? widget.onTap : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeInOut,
            height: _height,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: fill,
              borderRadius: BorderRadius.circular(KalloRadii.button),
            ),
            child: Text(
              'logging.confirm'.tr(),
              style: KalloTextStyles.sansSemiBold(
                fontSize: KalloFontSize.md,
              ).copyWith(color: fg),
            ),
          ),
        ),
      ),
    );
  }
}

/// Everything the staged card ASKS for, under the content it commits: the
/// full-width confirm pill and the quiet icon row beneath it.
///
/// Split out of [MealEntry] because the card's own file is at its size budget
/// and this is the seam — nothing here reads the quantity draft, only the
/// decision to submit it.
class MealEntryCommitRow extends StatelessWidget {
  const MealEntryCommitRow({
    super.key,
    required this.editing,
    required this.revealing,
    required this.disabled,
    required this.onConfirm,
    required this.actions,
  });

  final bool editing;

  /// The reveal morph's opening frame: the pill slides up into the slot the
  /// spinner row has just slid out of.
  final bool revealing;

  final bool disabled;
  final VoidCallback onConfirm;

  /// A staged card's discard lives here — BENEATH the button, never beside it,
  /// where a trash target would read as the confirm's equal. Empty draws no
  /// second row at all.
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final button = MealEntryConfirmButton(
      editing: editing,
      disabled: disabled,
      onTap: disabled ? null : onConfirm,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The house step, NOT [LoggingSpacing.actions] like the icon row below.
        // That token is 2 because an icon button carries (44 − 21) / 2 ≈ 11.5
        // of centring inset above its glyph, which supplies the rest of the
        // gap. The pill is a filled 50pt block with no inset at all, so 2 was
        // the whole gap: the card's white and the pill's beige met with a
        // 2px seam and read as one welded slab.
        const SizedBox(height: LoggingSpacing.turn),
        revealing ? FadeInUp(offset: 12, child: button) : button,
        if (actions.isNotEmpty) ...[
          const SizedBox(height: LoggingSpacing.actions),
          Row(children: [const Spacer(), ...actions]),
        ],
      ],
    );
  }
}
