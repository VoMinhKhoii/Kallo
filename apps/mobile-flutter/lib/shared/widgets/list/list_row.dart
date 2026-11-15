import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'grouped_list_card.dart';

/// A grouped row uses the card's full width for its warm selection wash.
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

  /// Busy rows replace their affordance with a spinner and stop taking taps.
  final bool busy;

  final bool showChevron;
  final Widget? trailing;
  final bool selected;

  @override
  State<ListRow> createState() => _ListRowState();
}

class _ListRowState extends State<ListRow> {
  bool _pressed = false;

  bool get _interactive =>
      widget.enabled && !widget.busy && widget.onTap != null;

  @override
  Widget build(BuildContext context) {
    final Color inkColor = widget.danger ? KalloColors.danger : kInk;
    final Color fill = widget.danger ? KalloColors.danger10 : KalloColors.hover;

    final row = Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          left: -GroupedListCard.contentInset,
          right: -GroupedListCard.contentInset,
          top: 0,
          bottom: 0,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            color: _pressed || widget.selected ? fill : Colors.transparent,
          ),
        ),
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
                        const SizedBox(height: KalloSpacing.sp1),
                        Text(
                          widget.subline!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: dashMeta(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              _trailing(),
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
      onTap: _interactive ? widget.onTap : null,
      child: Opacity(opacity: opacity, child: content),
    );
  }

  Widget _trailing() {
    // A row waiting on its own action shows the spinner INSTEAD of its
    // value/chevron — the affordance it replaces is exactly what is pending.
    if (widget.busy) {
      return CupertinoActivityIndicator(radius: 7, color: kInkMuted);
    }
    final List<Widget> parts = [
      if (widget.value != null)
        Text(widget.value!, style: dashMeta(tabular: true)),
      if (widget.trailing != null) widget.trailing!,
      if (widget.showChevron)
        Icon(
          LucideIcons.chevronRight300,
          size: KalloIcons.tertiary,
          color: kInkMuted,
        ),
    ];
    if (parts.isEmpty) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < parts.length; i++) ...[
          if (i > 0) const SizedBox(width: KalloSpacing.sp2),
          parts[i],
        ],
      ],
    );
  }
}
