import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/logging_spacing.dart';
import 'meal_input_controls.dart';

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
    this.onModePressed,
    this.onBarcodePressed,
    this.modeLabel,
    this.modeIcon,
    this.hintText,
    this.notice,
    this.analyzing = false,
  });

  final MealInputController controller;
  final ValueChanged<String> onSubmit;
  final VoidCallback? onCancel;

  /// While true the action button shows Stop (the run can be cancelled) — but
  /// the field stays editable so a new meal can be typed mid-analysis (the
  /// requestId-supersede mechanism handles overlap).
  final bool analyzing;

  /// Opens the mode selector (Normal / Cheat meal / Manual). Rendered as an
  /// icon + label on the input bar's second line.
  final VoidCallback? onModePressed;

  /// One-tap barcode scanning next to the mode control — scanning a packaged
  /// product is frequent enough to skip the mode-sheet detour.
  final VoidCallback? onBarcodePressed;

  /// Label + icon of the currently selected mode, shown on the mode control.
  final String? modeLabel;
  final IconData? modeIcon;

  /// Placeholder override — cheat mode swaps in the occasion-flavored hint.
  final String? hintText;

  /// An optional band pinned across the TOP of the card, inside its border and
  /// clipped by its radius — currently the under-logged-day note. It sits in
  /// here rather than above the card so the message and the field that answers
  /// it read as one object.
  final Widget? notice;

  @override
  State<MealInput> createState() => _MealInputState();
}

class _MealInputState extends State<MealInput>
    with SingleTickerProviderStateMixin {
  static const double _maxHeight = 200;
  static const double _minHeight = 24;

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
          // No padding here — the notice band must reach the card's edges, so
          // the inset moves inward onto the field/controls column below.
          decoration: BoxDecoration(
            // Opaque: the feed reads through the DOCK, never through the field.
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
            border: Border.all(color: borderColor),
            // Ink contact + ambient under the accent glow — what lifts the
            // card off the feed scrolling behind it.
            boxShadow: [NhamShadows.md, NhamShadows.xs, glow],
          ),
          // Clip so the notice band takes the card's own top corners rather
          // than squaring them off.
          child: ClipRRect(
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
            child: child,
          ),
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.notice != null) widget.notice!,
          Padding(
            padding: LoggingSpacing.composer,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Line 1 — the composer field, full width.
                ConstrainedBox(
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
                    style: dashBody(),
                    cursorColor: NhamColors.accent,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 4),
                      hintText:
                          widget.hintText ?? 'logging.composerPlaceholder'.tr(),
                      hintStyle: dashBody(color: kInkMuted),
                    ),
                  ),
                ),
                const SizedBox(height: NhamSpacing.sp2),
                // Line 2 — mode selector on the left, send/stop on the right.
                Row(
                  children: [
                    if (widget.onModePressed != null && !widget.analyzing)
                      ComposerModeButton(
                        icon: widget.modeIcon ?? LucideIcons.zap,
                        label: widget.modeLabel ??
                            'logging.modeSelector.button'.tr(),
                        onTap: widget.onModePressed!,
                      ),
                    if (widget.onBarcodePressed != null && !widget.analyzing)
                      ComposerBarcodeButton(onTap: widget.onBarcodePressed!),
                    const Spacer(),
                    if (!_canSubmit &&
                        widget.analyzing &&
                        widget.onCancel != null)
                      ComposerActionButton(
                        icon: LucideIcons.square, // lucide Square (filled)
                        iconSize: LoggingIcons.size,
                        label: 'common.cancel'.tr(),
                        onTap: widget.onCancel,
                      )
                    else
                      ComposerActionButton(
                        icon: LucideIcons.arrowUp, // lucide ArrowUp
                        iconSize: LoggingIcons.size,
                        label: 'logging.submit'.tr(),
                        enabled: _canSubmit,
                        onTap: _canSubmit ? _submit : null,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
