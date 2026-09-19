import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// One row in a settings popover list — [CustomSelect]'s options and
/// [CountrySelect]'s countries alike.
///
/// The two used to be private near-copies (`_DropdownRow`, `_CountryRow`) living
/// in their own parents, and when each parent was split for size they became
/// two PUBLIC near-copies in this folder — the same duplication, promoted.
/// About forty of fifty body lines were identical: the press state, the
/// semantics contract, the 150ms colour transition, and the haptic rule.
///
/// Only four things ever differed, and all four are parameters here:
/// what sits at the trailing edge, whether a selected row paints a wash,
/// the vertical padding, and the semantics label.
///
/// The haptic rule lives here once. A row is what knows whether a tap is a
/// CHANGE, so re-tapping the value already selected must not tick — an
/// invariant that drifts the moment it is written down twice.
class SelectRow extends StatefulWidget {
  const SelectRow({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.trailing,
    this.semanticsLabel,
    this.selectedColor,
    this.verticalPadding = KalloSpacing.sp2,
  });

  /// The row's own text, which fills the line.
  final String label;

  final bool selected;
  final VoidCallback onTap;

  /// Trailing edge: the Vietnamese alias on a country, a check glyph on an
  /// option. Null leaves the label the whole width.
  final Widget? trailing;

  /// Defaults to [label]; countries announce "English, Tiếng Việt".
  final String? semanticsLabel;

  /// Wash for the selected row. Null means selection is carried by [trailing]
  /// alone, which is what the option list does with its check glyph.
  final Color? selectedColor;

  final double verticalPadding;

  @override
  State<SelectRow> createState() => _SelectRowState();
}

class _SelectRowState extends State<SelectRow> {
  bool _pressed = false;

  void _handleTap() {
    if (!widget.selected) HapticFeedback.selectionClick();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    // A supplied selected wash wins; otherwise the row still answers the
    // finger. `_DropdownRow` washed on press REGARDLESS of selection, because
    // its selection is a check glyph and not a fill — and collapsing the two
    // rows quietly dropped that: `selected ? selectedColor : ...` returned null
    // for the currently-selected option, which passes no wash, so pressing or
    // holding the option you already have gave no feedback at all. `_CountryRow`
    // is unchanged by this: it always supplies a wash, and that wash still wins
    // over the press, exactly as before.
    final Color? selectedWash = widget.selected ? widget.selectedColor : null;
    final Color? bg = selectedWash ?? (_pressed ? KalloColors.track : null);

    return Semantics(
      button: true,
      selected: widget.selected,
      excludeSemantics: true,
      label: widget.semanticsLabel ?? widget.label,
      onTap: _handleTap,
      child: GestureDetector(
        onTap: _handleTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150), // transition-colors
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(
              KalloRadii.lg,
            ), // rounded-lg = 10
          ),
          padding: EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp3,
            vertical: widget.verticalPadding,
          ),
          child: Row(
            children: [
              Expanded(child: Text(widget.label, style: dashBody())),
              // Pattern, not `trailing!`: the app pins SDK ^3.7.0, so
              // null-aware elements are unavailable, and a force-unwrap
              // would paper over the very optionality this declares.
              if (widget.trailing case final Widget trailing) trailing,
            ],
          ),
        ),
      ),
    );
  }
}
