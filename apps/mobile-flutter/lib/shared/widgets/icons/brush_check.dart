import 'package:flutter/widgets.dart';

import '../../../theme/kallo_colors.dart';
import 'tinted_svg.dart';

/// A hand-drawn brush check — the "you get this" mark on the paywall's
/// Free ↔ Pro table.
///
/// Not Lucide's `check`. That glyph is a uniform 1.5 stroke, which is right
/// for a control (a checkbox, a selected row) and wrong here: these ticks are
/// the argument the table is making, and eight rows of even-weight hairline
/// read as a form rather than as a list of things you are being given. This
/// one is a FILLED shape with a brush's weight distribution — a fat rounded
/// hook at the left, a heavy trough, and a long sweep tapering to a fine
/// point — so it reads as marked by hand.
///
/// It fills far more of the 24 grid than the Lucide check does (≈18x18.5
/// against ≈17x12.5), so it is deliberately NOT optically compensated upward:
/// at the tertiary tier's nominal 18 it already carries more ink than the
/// glyph it replaced, which is the intent, and at 20 it starts to out-ink the
/// 14pt row label beside it. Checked against a mock of the real row at device
/// scale before it shipped.
class BrushCheck extends StatelessWidget {
  const BrushCheck({
    required this.size,
    this.color = KalloColors.successAccent,
    super.key,
  });

  final double size;

  /// Emerald in the Pro column, muted ink in the Free one: both mean
  /// "included", and the colour is what says which column is the offer.
  final Color color;

  @override
  Widget build(BuildContext context) => TintedSvg(
    svg: _svg,
    size: size,
    color: color,
    // The row's label says what is included; the mark is not a second thing
    // to announce. The COLUMN heading gives it its meaning, and a screen
    // reader gets that from the table's own text.
    excludeFromSemantics: true,
  );
}

/// Parses the mark ahead of the paywall's first frame — see
/// [precacheTintedSvg]. Nine of these land at once when the table builds, all
/// resolving to one cache entry; warming it at app start keeps that single
/// parse off the frame the paywall opens on.
void precacheBrushCheck() => precacheTintedSvg(_svg);

const String _svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000">'
    '<path d="M4.6 12.4C5.3 10.0 7.8 10.1 9.0 12.8C9.4 13.7 9.8 14.2 10.1 14.9'
    'C12.6 11.9 16.7 7.0 21.7 3.0L22.7 2.9C19.2 6.8 14.1 13.4 11.0 19.6'
    'L10.1 21.4L9.1 19.6C7.9 17.1 6.7 14.1 5.7 12.9C5.3 12.5 4.95 12.35 4.6 12.4Z"/>'
    '</svg>';
