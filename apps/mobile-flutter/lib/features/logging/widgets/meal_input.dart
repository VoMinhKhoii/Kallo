import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// Imperative handle for [MealInput] — the RN `MealInputHandle`
/// (`getText` / `clear` / `focus` / `setText`). The feed clears the field on
/// submit and seeds it from suggestion taps.
class MealInputController {
  _MealInputState? _state;

  String getText() => _state?._controller.text ?? '';
  void clear() => _state?._setText('');
  void focus() => _state?._focusNode.requestFocus();
  void setText(String text) => _state?._setText(text);
}

/// Natural-language meal composer: a growing multiline input + submit/stop.
///
/// Ported 1:1 from `apps/mobile/src/components/logging/input/meal-input.tsx`.
class MealInput extends StatefulWidget {
  const MealInput({
    super.key,
    required this.controller,
    required this.onSubmit,
    this.onCancel,
    this.analyzing = false,
  });

  final MealInputController controller;
  final ValueChanged<String> onSubmit;
  final VoidCallback? onCancel;

  /// While true the action button shows Stop (the run can be cancelled) — but
  /// the field stays editable so a new meal can be typed mid-analysis (the
  /// requestId-supersede mechanism handles overlap).
  final bool analyzing;

  @override
  State<MealInput> createState() => _MealInputState();
}

class _MealInputState extends State<MealInput>
    with SingleTickerProviderStateMixin {
  static const double _maxHeight = 200;
  static const double _minHeight = 32;

  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  // Border + shadow crossfade on focus over 300ms.
  late final AnimationController _focus = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
  );

  @override
  void initState() {
    super.initState();
    widget.controller._state = this;
    _controller.addListener(_onChanged);
    _focusNode.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(MealInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller._state = null;
      widget.controller._state = this;
    }
  }

  @override
  void dispose() {
    widget.controller._state = null;
    _controller.dispose();
    _focusNode.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged() => setState(() {});

  void _onFocusChange() {
    if (_focusNode.hasFocus) {
      _focus.forward();
    } else {
      _focus.reverse();
    }
  }

  void _setText(String text) {
    _controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  bool get _canSubmit => _controller.text.trim().isNotEmpty;

  void _submit() {
    if (_canSubmit) {
      HapticFeedback.lightImpact();
      widget.onSubmit(_controller.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _focus,
      builder: (context, child) {
        final t = _focus.value;
        final borderColor =
            Color.lerp(
              NhamColors.borderBiscotti40,
              NhamColors.borderAccent40,
              t,
            )!;
        // Interpolate the input glow opacity (resting → focus).
        final glow = BoxShadow(
          color: NhamColors.accent.withValues(alpha: 0.06 + t * 0.06),
          blurRadius: 20,
          offset: const Offset(0, 4),
        );
        return Container(
          padding: const EdgeInsets.all(NhamSpacing.sp3),
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
            border: Border.all(color: borderColor),
            boxShadow: [glow],
          ),
          child: child,
        );
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                minHeight: _minHeight,
                maxHeight: _maxHeight,
              ),
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                maxLines: null,
                keyboardType: TextInputType.multiline,
                textInputAction: TextInputAction.newline,
                style: NhamTextStyles.sansRegular(
                  fontSize: NhamFontSize.sm,
                  height: 20 / 14, // leading-5 (20px) at text-sm (14px)
                ).copyWith(color: NhamColors.text),
                cursorColor: NhamColors.accent,
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    vertical: 6,
                  ), // py-1.5
                  hintText: 'logging.placeholder'.tr(),
                  hintStyle: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.sm,
                    height: 20 / 14,
                  ).copyWith(color: NhamColors.placeholderMuted40),
                ),
              ),
            ),
          ),
          const SizedBox(width: NhamSpacing.sp3),
          if (widget.analyzing && widget.onCancel != null)
            _ActionButton(
              icon: Icons.stop, // lucide Square (filled) → Icons.stop
              iconSize: 14,
              label: 'common.cancel'.tr(),
              onTap: widget.onCancel,
            )
          else
            _ActionButton(
              icon: Icons.arrow_upward, // lucide ArrowUp → Icons.arrow_upward
              iconSize: 16,
              label: 'logging.submit'.tr(),
              enabled: _canSubmit,
              onTap: _canSubmit ? _submit : null,
            ),
        ],
      ),
    );
  }
}

/// The 32x32, rounded-md, btn-umber submit/stop button. Pressed → scale 0.95 +
/// btn-hover bg (RN `active:bg-nham-btn-hover active:scale-95`). Disabled → 0.3.
class _ActionButton extends StatefulWidget {
  const _ActionButton({
    required this.icon,
    required this.iconSize,
    required this.label,
    this.onTap,
    this.enabled = true,
  });

  final IconData icon;
  final double iconSize;
  final String label;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  State<_ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<_ActionButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final tappable = widget.onTap != null;
    return Semantics(
      button: true,
      enabled: tappable,
      label: widget.label,
      child: GestureDetector(
        onTapDown: tappable ? (_) => setState(() => _pressed = true) : null,
        onTapUp: tappable ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: tappable ? () => setState(() => _pressed = false) : null,
        onTap: widget.onTap,
        // 44pt minimum tap target (HIG) around the 32pt visual button.
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: AnimatedScale(
              scale: _pressed ? 0.95 : 1,
              duration: const Duration(
                milliseconds: 200,
              ), // transition-all duration-200
              child: Opacity(
                opacity: widget.enabled ? 1 : 0.3,
                child: Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _pressed ? NhamColors.btnHover : NhamColors.btn,
                    borderRadius: BorderRadius.circular(NhamRadii.md),
                  ),
                  child: Icon(
                    widget.icon,
                    size: widget.iconSize,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
