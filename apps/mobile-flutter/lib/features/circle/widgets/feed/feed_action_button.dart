import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_pressable.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
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
const double _glyph = KalloIcons.tertiary;
const double _hit = KalloIcons.hit;

/// The inset between a button's ink and the edge of its box — the SAME on
/// every button in the row, labelled or not, and on both sides.
///
/// It is what makes the gaps equal: neighbouring boxes touch, so the
/// ink-to-ink gap is always [_sidePad] twice (28) whatever either button
/// holds. The row used to spend 0 on a glyph-only button and 10 on a labelled
/// one, so a count appearing under a heart MOVED its neighbours, and a fresh
/// post's three actions sat 39 and 23 apart.
const double _sidePad = KalloSpacing.sp3_5;

/// Actions sit one step darker than the calm secondary.
///
/// `calm_tokens.dart` holds the app to two text colours, and this is a
/// deliberate exception to it: at [kInkMuted] a 1.5-stroke glyph on the bright
/// canvas read as an affordance that had been switched off — and this row
/// already dims to 50% to mean exactly that, so the enabled and disabled
/// states were separated by very little. Data stays on the two-colour rule;
/// controls need to look pressable.
const Color _actionInk = KalloColors.textSoft;

/// One Circle-post action: a tertiary-tier glyph in a 44pt-tall target, with
/// an optional label riding alongside it INSIDE the same target — so a
/// labelled action grows sideways rather than growing a second hit box.
///
/// Every button pays the same [_sidePad] on both sides, which is what holds
/// the row's ink-to-ink gaps equal as counts and labels come and go.
class FeedActionButton extends StatelessWidget {
  const FeedActionButton({
    super.key,
    this.onTap,
    required this.icon,
    this.label,
    this.semanticLabel,
    this.activeGlyph,
    this.toggled,
    this.alignment = Alignment.center,
    this.glyphSize,
  });

  final VoidCallback? onTap;
  final IconData icon;

  /// Optical override for the glyph's point size — still the TERTIARY tier
  /// (`mobile.md`, *Icons*), not a fourth size.
  ///
  /// All three glyphs come off the same 24 grid at the same 1.5 stroke, and
  /// they still do not carry the same ink: `message-circle` and `copy` are
  /// convex, area-filling shapes covering ~20x20 of that grid, while `heart`
  /// is ~20x17.5 and tapers to a point. Set to one number they do not read as
  /// one size — the heart reads smaller than the two beside it. Compensating
  /// per glyph is what makes the row look like one tier. Null keeps the
  /// tier's nominal [_glyph].
  final double? glyphSize;

  /// Visible label beside the glyph — the heart's count, "Log this too". It
  /// is also what a labelled action is ANNOUNCED as: the text merges into this
  /// button's own semantics node, so it needs no [semanticLabel] beside it.
  /// Null prints nothing, which is how a zero count disappears.
  final String? label;

  /// Spoken name for an action whose [label] does not name it — a glyph-only
  /// action ("Reply"), or one whose visible text is a bare count.
  final String? semanticLabel;

  /// Non-null means this action reads as ON, and this is the glyph it wears
  /// instead of [icon] — one field for one state, so the two can never
  /// disagree about whether the action is lit.
  ///
  /// A widget rather than a `fill` axis because Lucide ships here as an icon
  /// FONT, and that font carries no FILL axis: `Icon(fill: 1)` compiles,
  /// changes nothing on the device, and still reads as 1 back in a test — so
  /// the hearted state passed its own test while never filling on a phone.
  /// The heart passes [FilledHeart], the same 24-grid path drawn as an inline
  /// SVG, which carries its own red — the swipe-to-delete red, so a hearted
  /// post looks hearted from across the row.
  final Widget? activeGlyph;

  /// The on/off state a screen reader announces, for an action that HAS one.
  /// Null is an action that is simply pressed (reply, "Log this too") rather
  /// than one that stays on.
  final bool? toggled;

  /// Where the glyph sits in its box — `centerLeft` for a row's FIRST action,
  /// so its glyph lands on the content column rather than 10pt in. That is
  /// what the canvas' -12 left margin buys, bought here without taking
  /// anything off the target.
  ///
  /// The leading action also drops the row's [_hit] minimum WIDTH. That
  /// minimum is what injected 26pt of trailing dead space into the heart's
  /// box — the actual mechanism behind the 39-vs-23 gaps — and dropping it
  /// makes the heart's tap target its ink plus one [_sidePad] (34x44 on a
  /// post with no count, wider with one) rather than 44x44. That is accepted
  /// because its left edge IS the card's content edge, so there is no
  /// neighbouring control to mis-hit; the 44 that a thumb misses on in a
  /// scrolling feed is the height, and the height is untouched.
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    // A wash, not a ripple (see `mobile.md`, "Platform — Cupertino wherever
    // it exists"): Material's InkWell here was unbounded, spreading over the
    // whole 44pt box and persisting for a hold. Tight height on purpose — a
    // Container with an alignment and no height is an Align that takes all
    // the height it is offered, which is how the thread composer once
    // ballooned over its own reply list.
    // One [_sidePad] on every side of every button, so neighbouring boxes
    // touch and the ink lands 28 apart whether or not a label is printing. A
    // glyph-only box measures 14+18+14 = 46, so [_hit]'s minimum width never
    // binds and the glyph keeps its own 14; the row's first action drops both
    // that minimum and its left pad, landing its glyph on the content column
    // (see [alignment]).
    final leading = alignment == Alignment.centerLeft;
    final Widget button = Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: KalloPressable(
        onTap: onTap,
        height: _hit,
        constraints: leading ? null : const BoxConstraints(minWidth: _hit),
        padding: EdgeInsets.only(left: leading ? 0 : _sidePad, right: _sidePad),
        alignment: alignment,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            activeGlyph ??
                Icon(icon, size: glyphSize ?? _glyph, color: _actionInk),
            if (label != null) ...[
              const SizedBox(width: KalloSpacing.sp1_5),
              Text(label!, style: dashMeta(color: _actionInk)),
            ],
          ],
        ),
      ),
    );
    // ALWAYS a button. Wrapping only when [semanticLabel] was given left "Log
    // this too" as a bare tappable label — VoiceOver read the words and never
    // said "button", so the one action with a visible name was the one that
    // did not announce as a control.
    //
    // Only [semanticLabel] is passed as the name: [label] is already inside
    // this node as text and merges into it, so naming it again reads the
    // action twice ("Log this too, Log this too"). The heart is that merge —
    // "Heart" here, its count as the text inside — and lands as one node
    // reading "Heart, 2, button".
    return Semantics(
      button: true,
      label: semanticLabel,
      toggled: toggled,
      child: button,
    );
  }
}
