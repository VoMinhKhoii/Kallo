import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// Threads / iOS–grouped settings primitives.
///
/// The Settings tab used to be flat transparent rows on cream, with grouping
/// carried only by a faint eyebrow label. That read as one long undifferentiated
/// list. These primitives borrow the Threads settings structure — bracketed,
/// high-contrast blocks with a consistent icon gutter — while staying on the
/// calm cream palette:
///
/// * **Grouping** — each section is a solid white [SettingsCard] lifting off the
///   cream page on the shared espresso card shadow, its rows hairline-divided.
/// * **Alignment** — every row shares one [_kGutter]-wide icon column, so all
///   labels start on the same x; dividers inset to that column so they begin at
///   the label, iOS-style.
/// * **Contrast** — white-on-cream figure/ground plus the two calm text colours
///   (`kInk` label, `kInkMuted` icon + subline) instead of transparent rows.

/// Width of the leading icon column. Labels and the inset dividers align to
/// `card padding + _kGutter`.
const double _kGutter = 22;
const double _kRowPadH = NhamSpacing.sp4; // 16
const double _kRowPadV = NhamSpacing.sp3; // 12
const double _kIconGap = NhamSpacing.sp3; // 12 — icon column → label
// Dividers begin at the label text (after the icon column + gap), iOS-style.
const double _kDividerIndent = _kRowPadH + _kGutter + _kIconGap;

/// An eyebrow-labelled section: a muted ALL-CAPS header above a grouped card.
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({
    super.key,
    required this.label,
    required this.children,
  });

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: NhamSpacing.sp1,
            bottom: NhamSpacing.sp2,
          ),
          child: Text(label.toUpperCase(), style: dashEyebrow()),
        ),
        SettingsCard(children: children),
      ],
    );
  }
}

/// A solid white grouped card: rows stacked and separated by inset hairlines,
/// the whole block clipped to the card radius and lifted on the card shadow.
class SettingsCard extends StatelessWidget {
  const SettingsCard({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) rows.add(const _RowDivider());
      rows.add(children[i]);
    }
    return Container(
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(kCardRadius),
        boxShadow: kCardShadows,
      ),
      // Clip the pressed row fill to the rounded card corners.
      child: ClipRRect(
        borderRadius: BorderRadius.circular(kCardRadius),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: rows,
        ),
      ),
    );
  }
}

/// Hairline between rows, inset to start at the label column (iOS grouped-list).
class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(left: _kDividerIndent),
      child: SizedBox(
        height: 1,
        child: ColoredBox(color: NhamColors.inputBorder),
      ),
    );
  }
}

/// One row inside a [SettingsCard]. Covers every settings row shape:
///
/// * a navigating preference row (icon, label, value [subline], chevron),
/// * a static info row (trailing [value] text, no [onTap]),
/// * an account action row ([danger] tint, [busy] spinner, [enabled] gating).
///
/// Press fades a warm hover fill across the full row (clipped by the card), and
/// darkens the icon + label from muted to `kInk` — the same affordance the flat
/// rows used, now bounded to the grouped block.
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
  });

  final IconData icon;
  final String label;

  /// Current-value subline under the label (goal pace, region, a URL).
  final String? subline;

  /// Static right-aligned value (the app version). Mutually exclusive with the
  /// chevron/spinner trailing slot in practice.
  final String? value;

  final VoidCallback? onTap;
  final bool danger;
  final bool enabled;
  final bool busy;
  final bool showChevron;

  @override
  State<SettingsRow> createState() => _SettingsRowState();
}

class _SettingsRowState extends State<SettingsRow> {
  bool _pressed = false;

  bool get _interactive => widget.enabled && widget.onTap != null;

  @override
  Widget build(BuildContext context) {
    // Colour resolution: danger rows tint terracotta; normal rows keep the icon
    // muted at rest and darken to espresso on press (label matches).
    final Color restColor = widget.danger ? NhamColors.danger : kInkMuted;
    final Color activeColor = widget.danger ? NhamColors.danger : kInk;
    // Label is primary data — espresso at rest (terracotta for danger rows).
    final Color labelColor = widget.danger ? NhamColors.danger : kInk;
    final Color iconColor = _pressed ? activeColor : restColor;
    final Color fill = widget.danger
        ? const Color(0x1AD37B69) // danger @ 10%
        : NhamColors.hover50;

    final row = Container(
      color: _pressed ? fill : Colors.transparent,
      padding: const EdgeInsets.symmetric(
        horizontal: _kRowPadH,
        vertical: _kRowPadV,
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

    if (!_interactive) {
      return Opacity(opacity: widget.enabled ? 1.0 : 0.6, child: row);
    }

    return Semantics(
      button: true,
      enabled: widget.enabled,
      excludeSemantics: true,
      label: widget.subline != null
          ? '${widget.label}, ${widget.subline}'
          : widget.label,
      onTap: widget.onTap,
      child: Opacity(
        opacity: widget.enabled ? 1.0 : 0.6,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          onTapDown: (_) => setState(() => _pressed = true),
          onTapUp: (_) => setState(() => _pressed = false),
          onTapCancel: () => setState(() => _pressed = false),
          child: row,
        ),
      ),
    );
  }

  Widget _trailing() {
    if (widget.busy) {
      return const SizedBox(
        width: 14,
        height: 14,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: kInkMuted,
        ),
      );
    }
    if (widget.value != null) {
      return Text(widget.value!, style: dashMeta(tabular: true));
    }
    if (widget.showChevron) {
      return const Icon(
        LucideIcons.chevronRight,
        size: 16,
        color: kInkMuted,
      );
    }
    return const SizedBox.shrink();
  }
}
