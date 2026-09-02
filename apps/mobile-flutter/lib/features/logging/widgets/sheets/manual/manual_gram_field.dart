import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../shared/widgets/form/decimal_input.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';

/// The gram amount on an added row: a bordered FIELD showing "180 g" (44pt,
/// radius 12, hairline), not a chip with a chevron — a chevron reads as a
/// dropdown, and tapping this opens the number pad instead (native pass,
/// 2026-08-31).
///
/// It sizes itself from SYMMETRIC vertical padding rather than being forced to
/// a height. A fixed box was the bug: `InputDecorator` anchors its input to
/// `contentPadding.top` and leaves any surplus height at the bottom, so a 36pt
/// box with zero vertical padding hung the number 6.5pt above the squircle's
/// centre. Symmetric padding centres it by construction, and lets the field
/// grow with Dynamic Type instead of clipping.
///
/// Keeps the raw text locally and reports the parsed number upstream, the same
/// contract [DecimalInput] uses, so an in-progress "18," is not erased on each
/// keystroke.
class ManualGramField extends StatefulWidget {
  const ManualGramField({
    super.key,
    required this.grams,
    required this.enabled,
    required this.onChanged,
  });

  final double? grams;
  final bool enabled;
  final ValueChanged<double?> onChanged;

  @override
  State<ManualGramField> createState() => _ManualGramFieldState();
}

class _ManualGramFieldState extends State<ManualGramField> {
  late final TextEditingController _controller = TextEditingController(
    text: _format(widget.grams),
  );

  static String _format(double? value) {
    if (value == null || value.isNaN) return '';
    if (value == value.truncateToDouble()) return value.truncate().toString();
    return value.toString();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double? _parse(String text) {
    if (text.trim().isEmpty) return null;
    final parsed = parseDecimalInput(text);
    return parsed.isFinite ? parsed : null;
  }

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
      borderSide: const BorderSide(color: kHairline),
    );
    return SizedBox(
      // Four digits and the unit ("9999 g") without the number reflowing.
      width: 88,
      child: TextField(
        controller: _controller,
        enabled: widget.enabled,
        textAlign: TextAlign.end,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
        onChanged: (raw) => widget.onChanged(_parse(raw)),
        cursorColor: KalloColors.accent,
        style: dashBody(),
        decoration: InputDecoration(
          isDense: true,
          // The app theme fills and outlines every field; a field this small
          // has to clear ALL four borders plus `filled` or it paints a second
          // box inside this one (see mobile.md, "InputDecorationTheme wins").
          filled: false,
          hintText: '100',
          hintStyle: dashBody(color: kInkMuted),
          suffixText: ' ${'logging.manualLogging.gramsUnit'.tr()}',
          suffixStyle: dashMeta(),
          // Vertical 12 over a 16/1.3 line (20.8) lands the box on ~45pt —
          // the 44pt minimum, paid symmetrically so the value is centred in it.
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 10,
            vertical: 12,
          ),
          border: border,
          enabledBorder: border,
          disabledBorder: border,
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
            borderSide: const BorderSide(
              color: KalloColors.accent40,
              width: 2,
            ),
          ),
        ),
      ),
    );
  }
}
