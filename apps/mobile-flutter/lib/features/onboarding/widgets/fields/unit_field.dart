import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/widgets/form/decimal_input.dart' show parseDecimalInput;
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// One of screen 3's three metrics: a muted label over a 52pt pill holding the
/// figure and its unit. The unit lives INSIDE the field, muted — "62 kg" is how
/// the answer reads back.
///
/// The decoration is spelled out in full rather than inherited: the app's
/// [InputDecorationTheme] sets `filled` and an outline border, and clearing
/// only `border` leaves the field painting its own box inside this one.
class UnitField extends StatefulWidget {
  const UnitField({
    super.key,
    required this.label,
    required this.unit,
    required this.initialValue,
    required this.onChanged,
    this.integer = false,
    this.hasError = false,
  });

  final String label;
  final String unit;

  /// Seeds the field once. The parent owns the value afterwards; re-syncing on
  /// every rebuild would fight an in-progress "65," mid-keystroke.
  final double? initialValue;

  /// `null` when the field is cleared — blank is a valid answer here.
  final ValueChanged<double?> onChanged;

  final bool integer;
  final bool hasError;

  static const double height = 52;

  @override
  State<UnitField> createState() => _UnitFieldState();
}

class _UnitFieldState extends State<UnitField> {
  late final TextEditingController _controller =
      TextEditingController(text: _initialText());

  String _initialText() {
    final value = widget.initialValue;
    if (value == null || value.isNaN) return '';
    if (value == value.truncateToDouble()) return value.truncate().toString();
    return value.toString();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _report(String raw) {
    if (raw.trim().isEmpty) return widget.onChanged(null);
    final parsed = parseDecimalInput(raw);
    if (parsed.isNaN) return widget.onChanged(null);
    widget.onChanged(widget.integer ? parsed.truncateToDouble() : parsed);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: dashMeta()),
        const SizedBox(height: KalloSpacing.sp1),
        Container(
          height: UnitField.height,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: kCardSurface,
            borderRadius: BorderRadius.circular(KalloRadii.input),
            border: Border.all(
              color: widget.hasError ? KalloColors.danger : KalloColors.border,
            ),
          ),
          // Right-aligned against its unit, not centred in the pill: the pair
          // reads as one token ("62 kg") at every digit count.
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: Row(
            children: [
              Expanded(child: _input()),
              const SizedBox(width: KalloSpacing.sp1),
              Text(widget.unit, maxLines: 1, style: dashMeta()),
            ],
          ),
        ),
      ],
    );
  }

  Widget _input() => TextField(
        controller: _controller,
        textAlign: TextAlign.end,
        keyboardType: TextInputType.numberWithOptions(decimal: !widget.integer),
        inputFormatters: [
          FilteringTextInputFormatter.allow(
            widget.integer ? RegExp(r'[0-9]') : RegExp(r'[0-9.,]'),
          ),
        ],
        onChanged: _report,
        style: dashBody(tabular: true),
        cursorColor: KalloColors.accent,
        decoration: const InputDecoration(
          isDense: true,
          filled: false,
          contentPadding: EdgeInsets.zero,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          disabledBorder: InputBorder.none,
        ),
      );
}
