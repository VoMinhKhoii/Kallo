import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../logic/manual/manual_display.dart';
import 'manual_subtitle.dart';

/// One food in either manual sheet: its Vietnamese name over the state/English
/// subtitle on the left, calories and a chevron (or the added check) on the
/// right — the calorie column centred on the WHOLE row, so a two-line name
/// never leaves the number hanging off its first line.
///
/// Rows keep one top/bottom padding and let their height follow the text, the
/// way an iOS list cell does, instead of a fixed height that clips a two-line
/// English name.
class ManualFoodRow extends StatefulWidget {
  const ManualFoodRow({
    super.key,
    required this.name,
    required this.subtitle,
    required this.kcal,
    required this.onTap,
    required this.semanticLabel,
    this.kcalUnitMuted = true,
    this.nameMaxLines = 2,
    this.added = false,
    this.addedLabel,
  });

  final String name;
  final ManualSubtitleText subtitle;

  /// The figure on the right, already formatted ("120").
  final String kcal;

  /// "120 kcal" as a figure with a muted unit (search: a density per 100 g),
  /// or one quiet ink line (the meal: this row's own calories).
  final bool kcalUnitMuted;
  final int nameMaxLines;

  /// Swaps the chevron for a check: this food is already in the meal.
  final bool added;
  final String? addedLabel;

  final VoidCallback? onTap;
  final String semanticLabel;

  @override
  State<ManualFoodRow> createState() => _ManualFoodRowState();
}

class _ManualFoodRowState extends State<ManualFoodRow> {
  bool _pressed = false;

  void _set(bool pressed) {
    if (_pressed != pressed) setState(() => _pressed = pressed);
  }

  @override
  Widget build(BuildContext context) {
    final onTap = widget.onTap;
    return Semantics(
      button: true,
      label: widget.semanticLabel,
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: onTap == null ? null : (_) => _set(true),
        onTapUp: (_) => _set(false),
        onTapCancel: () => _set(false),
        onTap:
            onTap == null
                ? null
                : () {
                  HapticFeedback.selectionClick();
                  onTap();
                },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          color: _pressed ? KalloColors.hover : const Color(0x00FFFFFF),
          padding: const EdgeInsets.symmetric(vertical: 12),
          constraints: const BoxConstraints(minHeight: 64),
          child: Row(
            children: [
              Expanded(child: _texts()),
              const SizedBox(width: 20),
              _trailing(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _texts() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        widget.name,
        maxLines: widget.nameMaxLines,
        overflow: TextOverflow.ellipsis,
        style: dashBody().copyWith(height: 1.3),
      ),
      if (widget.subtitle.lead != null || widget.subtitle.rest != null) ...[
        const SizedBox(height: 2),
        ManualSubtitle(subtitle: widget.subtitle),
      ],
    ],
  );

  Widget _trailing() => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      widget.kcalUnitMuted
          ? Text.rich(
            TextSpan(
              children: [
                TextSpan(text: widget.kcal, style: dashValue()),
                TextSpan(text: ' kcal', style: dashMeta()),
              ],
            ),
            maxLines: 1,
          )
          : Text(
            '${widget.kcal} kcal',
            maxLines: 1,
            style: dashMeta(color: kInk, tabular: true),
          ),
      const SizedBox(width: 4),
      widget.added
          ? Icon(
            LucideIcons.check300,
            size: 18,
            color: kInk,
            semanticLabel: widget.addedLabel,
          )
          : const Icon(LucideIcons.chevronRight300, size: 18, color: kInkMuted),
    ],
  );
}
