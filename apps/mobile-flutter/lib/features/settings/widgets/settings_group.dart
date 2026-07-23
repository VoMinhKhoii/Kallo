import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// Flat, Threads-calm settings primitives.
///
/// Hierarchy comes from **type and spacing, not surfaces**: rows sit directly on
/// the cream page — no cards, no fills at rest — each section headed by a quiet
/// eyebrow. Contrast is the two calm text colours: an espresso [kInk] label over
/// a subtle [kInkMuted] current-value subline. Every row shares one icon gutter
/// so the labels line up.

/// Width of the leading icon column — all labels start at `padding + _kGutter`.
const double _kGutter = 22;
const double _kRowPadH = NhamSpacing.sp3; // 12
const double _kRowPadV = NhamSpacing.sp2_5; // 10
const double _kIconGap = NhamSpacing.sp3; // 12 — icon column → label

/// An eyebrow-labelled section: a muted ALL-CAPS header above its rows. Rows are
/// spread flat (no wrapping surface) so nothing but the label + spacing groups
/// them.
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({super.key, required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: _kRowPadH, bottom: 4),
          child: Text(label.toUpperCase(), style: dashEyebrow()),
        ),
        ...children,
      ],
    );
  }
}

/// One flat settings row. Covers every row shape:
///
/// * a navigating preference row (icon, label, value [subline], chevron),
/// * a static info row (trailing [value] text, no [onTap]),
/// * an account action row ([danger] tint, [busy] spinner, [enabled] gating).
///
/// At rest the row is transparent on the cream page. Press fades a soft rounded
/// hover fill in and darkens the icon from muted to espresso — the calm tap
/// affordance, no card required.
class SettingsRow extends StatefulWidget {
  const SettingsRow({
    super.key,
    required this.icon,
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

  final IconData icon;
  final String label;

  /// Current-value subline under the label (goal pace, region, a URL).
  final String? subline;

  /// Static right-aligned value (the app version).
  final String? value;

  final VoidCallback? onTap;
  final bool danger;
  final bool enabled;
  final bool busy;
  final bool showChevron;
  final Widget? trailing;

  @override
  State<SettingsRow> createState() => _SettingsRowState();
}

class _SettingsRowState extends State<SettingsRow> {
  bool _pressed = false;

  bool get _interactive => widget.enabled && widget.onTap != null;

  @override
  Widget build(BuildContext context) {
    // Icon: muted grey at rest, espresso on press (terracotta for danger rows).
    final Color restColor = widget.danger ? NhamColors.danger : kInkMuted;
    final Color activeColor = widget.danger ? NhamColors.danger : kInk;
    // Label is primary data — espresso "black" (terracotta for danger rows).
    final Color labelColor = widget.danger ? NhamColors.danger : kInk;
    final Color iconColor = _pressed ? activeColor : restColor;
    final Color fill =
        widget.danger
            ? const Color(0x1AD37B69) // danger @ 10%
            : NhamColors.hover50;

    final row = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: _kRowPadH,
        vertical: _kRowPadV,
      ),
      decoration: BoxDecoration(
        color: _pressed ? fill : Colors.transparent,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: Row(
        children: [
          SizedBox(
            width: _kGutter,
            child: Icon(widget.icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: _kIconGap),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.label, style: dashBody(color: labelColor)),
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

    // A purely static row (no onTap — the version row) is just dimmable
    // content, no button semantics.
    if (widget.onTap == null) {
      return Opacity(opacity: widget.enabled ? 1.0 : 0.6, child: row);
    }

    // Any row with an onTap is announced as a button even while disabled (busy
    // export, the last-remaining sign-in method) — so a screen reader says
    // "dimmed button" instead of reading the raw text. Only a currently-
    // interactive row gets the press gestures.
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
      enabled: widget.enabled,
      excludeSemantics: true,
      label:
          widget.subline != null
              ? '${widget.label}, ${widget.subline}'
              : widget.label,
      onTap: widget.enabled ? widget.onTap : null,
      child: Opacity(opacity: widget.enabled ? 1.0 : 0.6, child: content),
    );
  }

  Widget _trailing() {
    if (widget.trailing != null) return widget.trailing!;
    if (widget.busy) {
      return const SizedBox(
        width: 14,
        height: 14,
        child: CircularProgressIndicator(strokeWidth: 2, color: kInkMuted),
      );
    }
    if (widget.value != null) {
      return Text(widget.value!, style: dashMeta(tabular: true));
    }
    if (widget.showChevron) {
      return const Icon(LucideIcons.chevronRight, size: 16, color: kInkMuted);
    }
    return const SizedBox.shrink();
  }
}
