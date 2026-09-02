import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// One row inside a [GroupedListCard] — the Settings anchor anatomy
/// generalized (native pass, 2026-08-31): optional leading 24pt glyph, Body
/// title in REGULAR weight (Threads and the Claude app set theirs regular —
/// medium made every row shout), Meta subline below, a quiet Meta value on
/// the right, optional 18pt chevron. 52pt minimum single-line, 60pt with a
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
    final Color fill =
        widget.danger ? KalloColors.danger10 : KalloColors.hover;

    final row = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeInOut,
      constraints:
          BoxConstraints(minHeight: widget.subline != null ? 60 : 52),
      color: _pressed ? fill : Colors.transparent,
      child: Row(
        children: [
          if (widget.icon != null || widget.leading != null) ...[
            SizedBox(
              width: KalloIcons.size,
              child: Center(
                child: widget.leading ??
                    Icon(widget.icon, size: KalloIcons.size, color: inkColor),
              ),
            ),
            const SizedBox(width: KalloSpacing.sp3),
          ],
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.label,
                  style: dashBody(color: inkColor),
                ),
                if (widget.subline != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    widget.subline!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: dashMeta(),
                  ),
                ],
              ],
            ),
          ),
          _trailing(),
        ],
      ),
    );

    // Dimmed whenever the row is not taking taps, so look and behavior agree.
    final double opacity = widget.enabled && !widget.busy ? 1.0 : 0.6;

    if (widget.onTap == null) {
      return Opacity(opacity: opacity, child: row);
    }

    final Widget content = _interactive
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
      label: widget.subline != null
          ? '${widget.label}, ${widget.subline}'
          : widget.label,
      // The accessibility action goes the same way the gesture does: a busy
      // row that still exposed `onTap` could be fired from VoiceOver while the
      // touch target was already inert.
      onTap: _interactive ? widget.onTap : null,
      child: Opacity(opacity: opacity, child: content),
    );
  }

  Widget _trailing() {
    // A row waiting on its own action shows the spinner INSTEAD of its
    // value/chevron — the affordance it replaces is exactly what is pending.
    if (widget.busy) {
      return const SizedBox(
        width: 14,
        height: 14,
        child: CircularProgressIndicator(strokeWidth: 2, color: kInkMuted),
      );
    }
    final List<Widget> parts = [
      if (widget.value != null)
        Text(widget.value!, style: dashMeta(tabular: true)),
      if (widget.trailing != null) widget.trailing!,
      if (widget.showChevron)
        // Disclosure chevrons join the tertiary tier (18) rather than keeping
        // a private 16 (Threads icon tiers, 2026-09-01): beside a 16pt row
        // label a 16pt chevron read as a speck.
        const Icon(
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
