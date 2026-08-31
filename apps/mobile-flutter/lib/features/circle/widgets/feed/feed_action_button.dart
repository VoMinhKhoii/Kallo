import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// Glyph size, and the minimum square the tap target must fill. Both are the
/// app-wide values now: 24 on 44. The row's old 16pt glyph read as a footnote
/// under a 14pt meal line rather than as the post's three controls.
///
/// The canvas pulls the action row's margins in (-8 top / -12 bottom) so the
/// post's bottom hugs its content. Flutter clips hit-testing to a parent's
/// box, so a negative margin here would take those points off the tap targets
/// as well as off the layout — the pull is paid by the day card's post padding
/// instead (see `feed_day_group.dart`), which moves the same pixels with all
/// 44pt intact.
const double _glyph = KalloIcons.size;
const double _hit = KalloIcons.hit;

/// Actions sit one step darker than the calm secondary.
///
/// `calm_tokens.dart` holds the app to two text colours, and this is a
/// deliberate exception to it: at [kInkMuted] a 1.5-stroke glyph on the bright
/// canvas read as an affordance that had been switched off — and this row
/// already dims to 50% to mean exactly that, so the enabled and disabled
/// states were separated by very little. Data stays on the two-colour rule;
/// controls need to look pressable.
const Color _actionInk = KalloColors.textSoft;

/// One Circle-post action: a 24pt glyph centred in a 44pt square, with an
/// optional label riding alongside it INSIDE the same target — so a labelled
/// action grows sideways rather than growing a second hit box.
class FeedActionButton extends StatelessWidget {
  const FeedActionButton({
    super.key,
    this.onTap,
    required this.icon,
    this.label,
    this.semanticLabel,
    this.fill,
    this.alignment = Alignment.center,
  });

  final VoidCallback? onTap;
  final IconData icon;

  /// Visible label beside the glyph — the heart's count, "Log this too". A
  /// glyph-only action passes [semanticLabel] instead.
  final String? label;

  /// Spoken name for a glyph-only action.
  final String? semanticLabel;

  /// Icon fill, for the hearted state.
  final double? fill;

  /// Where the glyph sits in its box — `centerLeft` for a row's FIRST action,
  /// so its glyph lands on the content column rather than 10pt in. That is
  /// what the canvas' -12 left margin buys, bought here without taking
  /// anything off the target.
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final Widget button = Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: _hit, minWidth: _hit),
          padding: EdgeInsets.only(
            left: alignment == Alignment.centerLeft
                ? 0
                : (label == null ? 0 : KalloSpacing.sp2_5),
            right: label == null ? 0 : KalloSpacing.sp2_5,
          ),
          alignment: alignment,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: _glyph,
                color: fill == 1 ? kInk : _actionInk,
                fill: fill,
              ),
              if (label != null) ...[
                const SizedBox(width: KalloSpacing.sp1_5),
                Text(label!, style: dashMeta(color: _actionInk)),
              ],
            ],
          ),
        ),
      ),
    );
    if (semanticLabel == null) return button;
    return Semantics(button: true, label: semanticLabel, child: button);
  }
}
