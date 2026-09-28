import 'package:flutter/cupertino.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../../../theme/kallo_theme.dart';

/// One editable nutrient: its name on the left, the figure and unit on the
/// right — the row's value, typed in place.
///
/// **Blank and 0 are different answers** (owner review). An empty field shows
/// a grey "—" and saves as unknown: the label doesn't list it. "0" is ink and
/// saves as zero: it has none. Nothing turns one into the other.
class ScanEditorField extends StatelessWidget {
  const ScanEditorField({
    super.key,
    required this.label,
    required this.controller,
    required this.unit,
    this.icon,
    this.iconColor,
    this.errorText,
    this.filledNote,
  });

  final String label;
  final TextEditingController controller;
  final String unit;

  /// The macro's food glyph, in its colour.
  final IconData? icon;
  final Color? iconColor;

  /// Why the figure can't be saved ("Max 5,000 g") — the figure turns red and
  /// this reads under the row, so a greyed-out Save has its reason in place.
  final String? errorText;

  /// Set while the figure was worked out rather than typed: says so, muted,
  /// under the row, and a tap selects the figure so typing replaces it.
  final String? filledNote;

  static const double _iconGap = 6;

  @override
  Widget build(BuildContext context) {
    final row = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: iconColor),
            const SizedBox(width: _iconGap),
          ],
          Expanded(
            child: Text(
              label,
              style: dashBody(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          SizedBox(
            width: 104,
            child: CupertinoTextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              textAlign: TextAlign.end,
              decoration: null,
              padding: const EdgeInsets.symmetric(vertical: 12),
              style: dashValue(
                color: errorText != null ? KalloColors.danger : kInk,
              ),
              placeholder: '—',
              placeholderStyle: dashValue(color: KalloColors.textMuted),
              cursorColor: kInk,
              // Runs after the tap has placed the caret, so this wins.
              onTap:
                  filledNote == null
                      ? null
                      : () =>
                          controller.selection = TextSelection(
                            baseOffset: 0,
                            extentOffset: controller.text.length,
                          ),
            ),
          ),
          const SizedBox(width: KalloSpacing.sp1),
          SizedBox(width: 34, child: Text(unit, style: dashMeta())),
        ],
      ),
    );
    final caption = errorText ?? filledNote;
    if (caption == null) return row;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row,
        Padding(
          // Under the label's own text, past the macro glyph.
          padding: EdgeInsetsDirectional.only(
            start: icon == null ? 0 : 16 + _iconGap,
            bottom: KalloSpacing.sp3,
          ),
          child: Text(
            caption,
            style:
                errorText != null
                    ? dashMeta(color: KalloColors.danger)
                    : dashMeta(),
          ),
        ),
      ],
    );
  }
}
