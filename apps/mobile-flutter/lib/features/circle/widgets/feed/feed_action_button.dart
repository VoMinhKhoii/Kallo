import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../shared/widgets/surface/kallo_pressable.dart';
import '../../../../theme/kallo_theme.dart';

/// Glyph size, and the minimum square the tap target must fill. Both are the
/// app-wide values now: 18 on 44. The row's old 16pt glyph read as a footnote
/// under a 14pt meal line rather than as the post's three controls.
///
/// The canvas pulls the action row's margins in (-8 top / -12 bottom) so the
/// post's bottom hugs its content. Flutter clips hit-testing to a parent's
/// box, so a negative margin here would take those points off the tap targets
/// as well as off the layout — the pull is paid by the day card's post padding
/// instead (see `feed_day_group.dart`), which moves the same pixels with all
/// 44pt intact.
// Heart / comment / Eat-this take the TERTIARY tier (18), one step under the
// card-action 21 they wore from the Threads icon pass (2026-09-01).
//
// The action tier is sized for a control that carries its card — the Log
// action row, a confirm check. These three sit under a meal name at the very
// bottom of a post and read as its footnotes, not as the post's controls; at
// 21 the cluster out-weighed the meal it belongs to. All THREE move together:
// two glyphs at 18 beside a third at 21 is a row that looks misaligned rather
// than one that looks quieter. The 44pt target is untouched at either size.
const double _glyph = KalloIcons.tertiary;
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

/// One Circle-post action: an 18pt glyph centred in a 44pt square, with an
/// optional label riding alongside it INSIDE the same target — so a labelled
/// action grows sideways rather than growing a second hit box.
class FeedActionButton extends StatelessWidget {
  const FeedActionButton({
    super.key,
    this.onTap,
    required this.icon,
    this.label,
    this.semanticLabel,
    this.active = false,
    this.activeGlyph,
    this.activeColor = kInk,
    this.alignment = Alignment.center,
  });

  final VoidCallback? onTap;
  final IconData icon;

  /// Visible label beside the glyph — the heart's count, "Log this too". A
  /// glyph-only action passes [semanticLabel] instead.
  final String? label;

  /// Spoken name for a glyph-only action.
  final String? semanticLabel;

  /// Whether the action reads as "on" — hearted, and nothing else so far.
  final bool active;

  /// What to draw INSTEAD of [icon] while [active], for an action whose on
  /// state is a different shape rather than a different colour.
  ///
  /// A widget rather than a `fill` axis because Lucide ships here as an icon
  /// FONT, and that font carries no FILL axis: `Icon(fill: 1)` compiles,
  /// changes nothing on the device, and still reads as 1 back in a test — so
  /// the hearted state passed its own test while never filling on a phone.
  /// The heart passes [FilledHeart], the same 24-grid path drawn as an inline
  /// SVG. With no glyph the active state is [activeColor] alone.
  final Widget? activeGlyph;

  /// Glyph colour once [active] — the "on" state's own colour.
  ///
  /// Defaults to [kInk], which is what an activated action wore before the
  /// heart needed its own. The heart passes [KalloColors.danger]: at ink a
  /// filled heart was the same near-black as the two glyphs beside it, so
  /// reacting read as "slightly bolder" rather than as liked. It is the red
  /// the swipe-to-delete action already paints, so the palette gains nothing.
  final Color activeColor;

  /// Where the glyph sits in its box — `centerLeft` for a row's FIRST action,
  /// so its glyph lands on the content column rather than 10pt in. That is
  /// what the canvas' -12 left margin buys, bought here without taking
  /// anything off the target.
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    // A wash, not a ripple (see `mobile.md`, "Platform — Cupertino wherever
    // it exists"): Material's InkWell here was unbounded, spreading over the
    // whole 44pt box and persisting for a hold. Tight height on purpose — a
    // Container with an alignment and no height is an Align that takes all
    // the height it is offered, which is how the thread composer once
    // ballooned over its own reply list.
    // A labelled action breathes sideways inside its target; a glyph-only one
    // is the bare 44pt square. A row's first action drops the leading pad so
    // its glyph lands on the content column.
    final sidePad = label == null ? 0.0 : KalloSpacing.sp2_5;
    final Widget button = Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: KalloPressable(
        onTap: onTap,
        height: _hit,
        constraints: const BoxConstraints(minWidth: _hit),
        padding: EdgeInsets.only(
          left: alignment == Alignment.centerLeft ? 0 : sidePad,
          right: sidePad,
        ),
        alignment: alignment,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            active && activeGlyph != null
                ? activeGlyph!
                : Icon(
                  icon,
                  size: _glyph,
                  color: active ? activeColor : _actionInk,
                ),
            if (label != null) ...[
              const SizedBox(width: KalloSpacing.sp1_5),
              Text(label!, style: dashMeta(color: _actionInk)),
            ],
          ],
        ),
      ),
    );
    if (semanticLabel == null) return button;
    return Semantics(button: true, label: semanticLabel, child: button);
  }
}
