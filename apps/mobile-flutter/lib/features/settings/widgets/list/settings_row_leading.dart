import 'package:flutter/material.dart';

import '../../../../theme/kallo_theme.dart';

/// Leading glyph — the app-wide control size, so a settings icon carries its
/// row instead of trailing it.
const double kSettingsRowIcon = KalloIcons.size; // 24

/// Width of the leading icon column — every label starts at
/// `rowPadH + kSettingsRowGutter`. The gutter is exactly the glyph, so the
/// glyph's left edge is flush with the group header above it.
const double kSettingsRowGutter = kSettingsRowIcon;

/// The label's own line box (`dashBody`: fontSize 14 × height 1.3).
const double _kTitleLine = 14 * 1.3;

/// The icon gutter of one settings row.
///
/// The glyph is centred on the **title's first line**, not on the row. A row
/// with a subline is two lines tall, and centring across both left the icon
/// floating in the gap between them; anchored to the title it reads as one
/// line with the label, which is the iOS/Threads shape.
///
/// [OverflowBox] is doing real work here and is not incidental: a 24 glyph is
/// taller than the 18.2 title line, and a plain `Center` inside a tight
/// [SizedBox] would hand the `Icon` a squashed 24×18.2 box to lay itself out
/// in. `OverflowBox` replaces the incoming constraints instead, so the glyph
/// gets a true 24-square and is centred on the line — ~2.9px of overhang each
/// way, absorbed by the row's own 10px vertical padding, clipped by nothing.
class SettingsRowLeading extends StatelessWidget {
  const SettingsRowLeading({
    super.key,
    this.icon,
    this.leading,
    required this.color,
  });

  final IconData? icon;

  /// Custom gutter widget (the linked-account brand marks) instead of [icon].
  final Widget? leading;

  final Color color;

  @override
  Widget build(BuildContext context) {
    // Scale the anchor line with the user's type size — text grows up to the
    // 1.3x cap set in `app.dart`, and a fixed line box would let the icon
    // drift high at the top step.
    final double titleLine = MediaQuery.textScalerOf(
      context,
    ).scale(_kTitleLine);

    return SizedBox(
      width: kSettingsRowGutter,
      height: titleLine,
      child: OverflowBox(
        minWidth: 0,
        maxWidth: kSettingsRowIcon,
        minHeight: 0,
        maxHeight: kSettingsRowIcon,
        alignment: Alignment.center,
        child: leading ?? Icon(icon, size: kSettingsRowIcon, color: color),
      ),
    );
  }
}
