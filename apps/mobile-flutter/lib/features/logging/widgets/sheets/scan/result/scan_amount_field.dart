import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';

/// A custom amount you can type: the number in Value ink, the unit muted
/// beside it — "250 ml". Tapping the number opens the number pad in place.
///
/// **Never keyed on its value.** A key that changes per keystroke builds a new
/// field every time, which drops focus and the keyboard after one digit (the
/// bug this replaces). The field keeps one controller and pulls OUTSIDE
/// changes — a − / + press, a cup tapped on the ruler — into its text in
/// [didUpdateWidget], focused or not.
class ScanAmountField extends StatefulWidget {
  const ScanAmountField({
    super.key,
    required this.amount,
    required this.unit,
    required this.onChanged,
    this.enabled = true,
  });

  final int amount;

  /// "g" or "ml".
  final String unit;

  final ValueChanged<int> onChanged;
  final bool enabled;

  @override
  State<ScanAmountField> createState() => _ScanAmountFieldState();
}

class _ScanAmountFieldState extends State<ScanAmountField> {
  late final TextEditingController _controller = TextEditingController(
    text: '${widget.amount}',
  );
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      // Leaving the field empty or at 0 restores the amount that will be
      // logged, so what the field shows is always what Add meal sends.
      if (!_focus.hasFocus && (int.tryParse(_controller.text) ?? 0) <= 0) {
        _controller.text = '${widget.amount}';
      }
    });
  }

  @override
  void didUpdateWidget(ScanAmountField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (int.tryParse(_controller.text) != widget.amount) {
      _controller.value = TextEditingValue(
        text: '${widget.amount}',
        selection: TextSelection.collapsed(offset: '${widget.amount}'.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _typed(String text) {
    final value = int.tryParse(text);
    if (value == null || value <= 0) return;
    widget.onChanged(value);
  }

  @override
  Widget build(BuildContext context) {
    return IntrinsicWidth(
      child: CupertinoTextField(
        controller: _controller,
        focusNode: _focus,
        enabled: widget.enabled,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(6),
        ],
        textAlign: TextAlign.end,
        padding: EdgeInsets.zero,
        decoration: null,
        style: dashValue(),
        cursorColor: kInk,
        onChanged: _typed,
        onTapOutside: (_) => _focus.unfocus(),
        suffix: Padding(
          padding: const EdgeInsetsDirectional.only(start: 4),
          child: Text(widget.unit, style: dashMeta()),
        ),
        suffixMode: OverlayVisibilityMode.always,
        placeholderStyle: dashValue(color: KalloColors.textMuted),
      ),
    );
  }
}
