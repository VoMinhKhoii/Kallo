import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';

/// `parseDecimalInput`, vendored verbatim from the RN/web
/// `lib/dashboard/logic/format.ts`. Tolerates the comma decimal separator
/// iOS / VN keyboards emit; like the web, it replaces only the FIRST comma.
/// Returns [double.nan] for empty / unparseable input.
double parseDecimalInput(String value) {
  final normalized = value.trim().replaceFirst(',', '.');
  if (normalized.isEmpty) return double.nan;
  return double.tryParse(normalized) ?? double.nan;
}

/// RN port of `apps/mobile/src/components/shared/decimal-input.tsx`.
///
/// Keeps the user's raw text locally while reporting a parsed number upstream,
/// so an in-progress decimal separator ("65,") isn't erased on each keystroke.
/// When [integer] is true the reported value is truncated to a whole number and
/// the number-pad keyboard is shown.
class DecimalInput extends StatefulWidget {
  const DecimalInput({
    super.key,
    required this.value,
    required this.onValueChange,
    this.integer = false,
    this.hintText,
    this.textAlign = TextAlign.start,
    this.controller,
    this.focusNode,
    this.onSubmitted,
  });

  final double? value;
  final ValueChanged<double?> onValueChange;

  /// Restrict the reported value to a whole number (e.g. height, age).
  final bool integer;
  final String? hintText;
  final TextAlign textAlign;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final ValueChanged<String>? onSubmitted;

  @override
  State<DecimalInput> createState() => _DecimalInputState();
}

class _DecimalInputState extends State<DecimalInput> {
  late final TextEditingController _controller =
      widget.controller ?? TextEditingController(text: _valueToText(widget.value));
  late final FocusNode _focusNode = widget.focusNode ?? FocusNode();
  bool _ownsController = false;
  bool _ownsFocusNode = false;
  double? _syncedValue;

  @override
  void initState() {
    super.initState();
    _ownsController = widget.controller == null;
    _ownsFocusNode = widget.focusNode == null;
    if (!_ownsController) {
      _controller.text = _valueToText(widget.value);
    }
    _syncedValue = widget.value;
    _focusNode.addListener(_handleFocusChange);
  }

  @override
  void didUpdateWidget(DecimalInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Sync external value changes (form reset, async load) into the text
    // without clobbering an in-progress entry that parses to the same value.
    if (!_sameValue(widget.value, _syncedValue)) {
      _syncedValue = widget.value;
      final currentParsed = _textToValue(_controller.text);
      if (!_sameValue(currentParsed, widget.value)) {
        final next = _valueToText(widget.value);
        if (_controller.text != next) _controller.text = next;
      }
    }
  }

  void _handleFocusChange() {
    if (_focusNode.hasFocus) return;
    // On blur, normalize the text to the parsed value's canonical form.
    final parsed = _textToValue(_controller.text);
    if (parsed != null && parsed.isFinite) {
      final next = _valueToText(parsed);
      if (_controller.text != next) _controller.text = next;
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_handleFocusChange);
    if (_ownsFocusNode) _focusNode.dispose();
    if (_ownsController) _controller.dispose();
    super.dispose();
  }

  bool _sameValue(double? a, double? b) {
    if (a == null || b == null) return a == b;
    if (a.isNaN || b.isNaN) return a.isNaN && b.isNaN;
    return a == b;
  }

  String _valueToText(double? value) {
    if (value == null || value.isNaN) return '';
    // Match JS String(number): drop a trailing ".0" for whole numbers.
    if (value == value.truncateToDouble()) {
      return value.truncate().toString();
    }
    return value.toString();
  }

  double? _textToValue(String text) {
    if (text.trim().isEmpty) return null;
    final parsed = parseDecimalInput(text);
    if (widget.integer && parsed.isFinite) return parsed.truncateToDouble();
    return parsed;
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      focusNode: _focusNode,
      textAlign: widget.textAlign,
      keyboardType: widget.integer
          ? const TextInputType.numberWithOptions(decimal: false)
          : const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: widget.integer
          ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9]'))]
          : [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
      onChanged: (raw) => widget.onValueChange(_textToValue(raw)),
      onSubmitted: widget.onSubmitted,
      // Input: radii.md(8), 1px inputBorder, elev bg, 12/8 padding, 14px text.
      style: KalloTextStyles.sansRegular(fontSize: 14)
          .copyWith(color: KalloColors.text),
      cursorColor: KalloColors.accent,
      decoration: InputDecoration(
        isDense: true,
        hintText: widget.hintText,
        hintStyle: KalloTextStyles.sansRegular(fontSize: 14)
            .copyWith(color: KalloColors.textWarm),
        filled: true,
        fillColor: KalloColors.elev,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp3,
          vertical: KalloSpacing.sp2,
        ),
        border: _border(KalloColors.inputBorder),
        enabledBorder: _border(KalloColors.inputBorder),
        focusedBorder: _border(KalloColors.inputBorder),
      ),
    );
  }

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(KalloRadii.md),
        borderSide: BorderSide(color: color),
      );
}
