import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'grouped_list_card.dart';
import 'list_row_wash.dart';
import 'list_row_trailing.dart';

/// One row inside a [GroupedListCard] — the Settings anchor anatomy
/// generalized (native pass, 2026-08-31): optional leading 24pt glyph, Body
/// title in regular weight except the selected detail (medium everywhere
/// made every row shout), Meta subline below, a quiet Meta value on
/// the right, optional 18pt chevron. 52pt minimum single-line, 64pt with a
/// subline; the whole row is the tap target.
///
/// On the white card the press affordance is the warm wash (the canvas-side
/// rows use the neutral ink wash instead — see the original SettingsRow
/// rationale; on white the warm wash registers again).
class ListRow extends StatefulWidget {
  const ListRow({
    super.key,
    this.icon,
    this.leading,
    required this.label,
    this.subline,
    this.value,
    this.onTap,
    this.danger = false,
    this.enabled = true,
    this.busy = false,
    this.showChevron = false,
    this.trailing,
    this.selected = false,
  });

  /// Lucide glyph for the leading 24pt slot — ink (red on a [danger] row).
  final IconData? icon;

  /// Custom leading widget (an avatar, a brand mark) instead of [icon].
  final Widget? leading;

  final String label;

  /// Current-value subline under the label; makes the row 64pt.
  final String? subline;

  /// Quiet right-aligned value ("125 / 138 g avg", the app version).
  final String? value;

  final VoidCallback? onTap;
  final bool danger;
  final bool enabled;

  /// An action started from this row is in flight — a 14pt spinner replaces
  /// the value/chevron until it settles (account link/unlink, export, restore,
  /// sign out), and the row stops taking taps for the duration. Pass [enabled]
  /// only for a reason BEYOND this row's own action being busy.
  final bool busy;

  final bool showChevron;
  final Widget? trailing;
  final bool selected;

  @override
  State<ListRow> createState() => _ListRowState();
}

class _ListRowState extends State<ListRow> {
  bool _pressed = false;

  /// A row whose own action is in flight is not a target: [busy] already
  /// replaced its affordance with a spinner, so leaving it tappable only let a
  /// second tap through while the first was still running.
  bool get _interactive =>
      widget.enabled && !widget.busy && widget.onTap != null;

  @override
  Widget build(BuildContext context) {
    final Color inkColor = widget.danger ? KalloColors.danger : kInk;
    final Color fill = widget.danger ? KalloColors.danger10 : KalloColors.hover;

    final row = Stack(
      clipBehavior: Clip.none,
      children: [
        ListRowWash(color: fill, pressed: _pressed, selected: widget.selected),
        Container(
          constraints: BoxConstraints(
            minHeight: widget.subline != null ? 64 : 52,
          ),
          child: Row(
            children: [
              if (widget.icon != null || widget.leading != null) ...[
                SizedBox(
                  width: KalloIcons.size,
                  child: Center(
                    child:
                        widget.leading ??
                        Icon(
                          widget.icon,
                          size: KalloIcons.size,
                          color: inkColor,
                        ),
                  ),
                ),
                const SizedBox(width: KalloSpacing.sp3),
              ],
              Expanded(
                // Only bites when the subline wraps: a two-line block keeps
                // the same 12pt from the row's edges the one-line rows get
                // from the minimum height.
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: KalloSpacing.sp2,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.label,
                        style: dashBody(color: inkColor).copyWith(
                          fontWeight:
                              widget.selected
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                        ),
                      ),
                      if (widget.subline != null) ...[
                        // One step more air than the 2pt it had: two stacked lines
                        // read as one block at 2, as a label and its value at 4.
                        const SizedBox(height: KalloSpacing.sp1),
                        Text(
                          widget.subline!,
                          // A summary may take two lines ("Dầu vừa · Cơm vừa · …");
                          // a one-line ellipsis cut exactly the part that differed.
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: dashMeta(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              ListRowTrailing(
                busy: widget.busy,
                value: widget.value,
                trailing: widget.trailing,
                showChevron: widget.showChevron,
              ),
            ],
          ),
        ),
      ],
    );

    // Dimmed whenever the row is not taking taps, so look and behavior agree.
    final double opacity = widget.enabled && !widget.busy ? 1.0 : 0.6;

    if (widget.onTap == null) {
      return Opacity(opacity: opacity, child: row);
    }

    final Widget content =
        _interactive
            ? GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onTap,
              onTapDown: (_) => setState(() => _pressed = true),
              onTapUp: (_) => setState(() => _pressed = false),
              onTapCancel: () => setState(() => _pressed = false),
              child: row,
            )
            : row;

    return Semantics(
      button: true,
      enabled: _interactive,
      excludeSemantics: true,
      label:
          widget.subline != null
              ? '${widget.label}, ${widget.subline}'
              : widget.label,
      // The accessibility action goes the same way the gesture does: a busy
      // row that still exposed `onTap` could be fired from VoiceOver while the
      // touch target was already inert.
      onTap: _interactive ? widget.onTap : null,
      child: Opacity(opacity: opacity, child: content),
    );
  }
}
