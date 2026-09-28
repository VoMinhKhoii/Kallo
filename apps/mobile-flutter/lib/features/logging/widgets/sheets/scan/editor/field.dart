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
    this.error = false,
    this.placeholder = '—',
  });

  final String label;
  final TextEditingController controller;
  final String unit;

  /// The macro's food glyph, in its colour.
  final IconData? icon;
  final Color? iconColor;

  /// The figure doesn't parse or is out of range — shown in the danger ink.
  final bool error;

  /// What an empty field says: "—" (unknown, and fine), or "Required" on the
  /// four Done waits for — so a greyed-out Done has its reason on screen.
  final String placeholder;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: iconColor),
            const SizedBox(width: 6),
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
              style: dashValue(color: error ? KalloColors.danger : kInk),
              placeholder: placeholder,
              placeholderStyle: dashValue(color: KalloColors.textMuted),
              cursorColor: kInk,
            ),
          ),
          const SizedBox(width: KalloSpacing.sp1),
          SizedBox(width: 34, child: Text(unit, style: dashMeta())),
        ],
      ),
    );
  }
}
