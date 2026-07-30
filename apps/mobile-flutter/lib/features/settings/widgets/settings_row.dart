import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/settings_spacing.dart';
import 'settings_row_leading.dart';

/// Half of the app-wide 12 content inset; the list padding owns the other 4.
/// See [SettingsSpacing.rowList].
const double _kRowPadH = SettingsSpacing.rowPadH; // 8
const double _kRowPadV = NhamSpacing.sp2_5; // 10
const double _kIconGap = NhamSpacing.sp3; // 12 — icon column → label

/// One flat settings row. Covers every row shape:
///
/// * a navigating preference row (icon, label, value [subline], chevron),
/// * a static info row (trailing [value] text, no [onTap]),
/// * an account action row ([danger] tint, [busy] spinner, [enabled] gating).
///
/// At rest the row is transparent on the page, with the glyph in full ink
/// beside its label — the icon is content, not decoration. Press fades a soft
/// rounded ink wash in behind the whole row: the calm tap affordance, no card
/// required. (The icon used to carry that signal by darkening from muted to
/// ink; with the glyph already ink at rest, the wash is the whole affordance,
/// which is why it is a neutral ink wash and not the warm one — the warm wash
/// is lighter than the page and would not register.)
class SettingsRow extends StatefulWidget {
  const SettingsRow({
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
  }) : assert(
         icon != null || leading != null,
         'SettingsRow needs an icon or a leading widget',
       );

  /// Lucide glyph for the gutter — ink (terracotta on a [danger] row). Omit
  /// when supplying a custom [leading] (e.g. a brand mark with its own colour).
  final IconData? icon;

  /// Custom leading widget occupying the icon gutter instead of [icon] — used
  /// for the linked-account brand marks (Google's four-colour G, Apple in ink),
  /// which never take the press tint. Mirrors web `brand-logos.tsx`.
  final Widget? leading;
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
    // Icon and label are both primary content — one ink (terracotta on a
    // danger row), no press-state colour change.
    final Color inkColor = widget.danger ? NhamColors.danger : kInk;
    final Color fill =
        widget.danger
            ? const Color(0x1AD37B69) // danger @ 10%
            : NhamColors.pressWash;

    final row = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: _kRowPadH,
        vertical: _kRowPadV,
      ),
      decoration: BoxDecoration(
        color: _pressed ? fill : Colors.transparent,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      // The OUTER row stays centred so the chevron / value / switch sits on the
      // row's mid-line, where a trailing control belongs on a two-line row. The
      // INNER row is top-anchored so the icon lines up with the TITLE and the
      // subline hangs below it.
      child: Row(
        children: [
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SettingsRowLeading(
                  icon: widget.icon,
                  leading: widget.leading,
                  color: inkColor,
                ),
                const SizedBox(width: _kIconGap),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.label, style: dashBody(color: inkColor)),
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
      return const Icon(LucideIcons.chevronRight300, size: 16, color: kInkMuted);
    }
    return const SizedBox.shrink();
  }
}
