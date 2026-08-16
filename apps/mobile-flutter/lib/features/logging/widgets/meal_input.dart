import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/logging_spacing.dart';
import 'meal_input_controls.dart';
import 'relog/mention_text_controller.dart';

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
    this.textController,
    this.onSync,
    this.popupSlot,
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

  /// The field's text controller, supplied when the caller needs to read or
  /// tint what is in it — the feed passes its [MentionTextEditingController] so
  /// relog picks render as tinted runs inside the real field. Omitted (the
  /// quick-log sheet) the composer owns a plain one of its own.
  final MentionTextEditingController? textController;

  /// Fired whenever the value OR the caret may have moved. The relog picker
  /// keys off the token immediately left of the caret, and the caret moves
  /// without the text changing (taps, selection handles).
  final VoidCallback? onSync;

  /// Content stacked above the whole card — the `/` picker. It sits outside the
  /// card's border, the way it floats over the composer on the web.
  final Widget? popupSlot;

  @override
  State<MealInput> createState() => _MealInputState();
}

class _MealInputState extends State<MealInput>
    with SingleTickerProviderStateMixin {
  static const double _maxHeight = 200;
  static const double _minHeight = 24;

  /// Owned only when the caller didn't supply one — a controller belongs to
  /// whoever created it, and disposing a borrowed one would break the feed the
  /// moment the composer rebuilt.
  ///
  /// INVARIANT: a caller either supplies [MealInput.textController] for this
  /// widget's whole life or never supplies one. `late final` bakes that in — a
  /// caller that started at null and later passed a controller would strand
  /// this one undisposed, since [dispose] only frees it while `_ownsController`
  /// is still true. Both call sites hold to it: the feed owns one controller
  /// for the life of the screen, and the quick-log sheet passes none.
  late final MentionTextEditingController _ownedController =
      MentionTextEditingController();
  bool _ownsController = false;

  MentionTextEditingController get _controller =>
      widget.textController ?? _ownedController;

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
    _ownsController = widget.textController == null;
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
    // Move the listener with the controller, or a swapped-in field would go
    // silent: no mention reconciliation, no `/` picker, no submit arming.
    if (oldWidget.textController != widget.textController) {
      (oldWidget.textController ?? _ownedController).removeListener(_onChanged);
      _ownsController = widget.textController == null;
      _controller.addListener(_onChanged);
    }
  }

  @override
  void dispose() {
    widget.controller._state = null;
    _controller.removeListener(_onChanged);
    if (_ownsController) _ownedController.dispose();
    _focusNode.dispose();
    _focus.dispose();
    super.dispose();
  }

  /// One handler for every "the value or the caret may have moved" signal. The
  /// mentions are re-located FIRST so a broken label has already dropped its
  /// reference by the time the picker re-reads the token.
  void _onChanged() {
    _controller.syncMentions();
    widget.onSync?.call();
    setState(() {});
  }

  void _onFocusChange() {
    if (_focusNode.hasFocus) {
      _focus.forward();
    } else {
      _focus.reverse();
    }
  }

  void _setText(String text) => _controller.setTextAndSync(text);

  /// A relog pick writes its `/Name` label into the value, so a picks-only
  /// submission is already non-empty text — there is nothing submittable that
  /// lives outside the field.
  bool get _canSubmit => _controller.text.trim().isNotEmpty;

  void _submit() {
    if (_canSubmit) {
      HapticFeedback.lightImpact();
      widget.onSubmit(_controller.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final card = _buildCard(context);
    if (widget.popupSlot == null) return card;
    // The picker sits OUTSIDE the card's border, above it — the composer stays
    // one object and the picker reads as a sheet floating over the feed.
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [widget.popupSlot!, card],
    );
  }

  Widget _buildCard(BuildContext context) {
    return AnimatedBuilder(
      animation: _focus,
      builder: (context, child) {
        final t = _focus.value;
        final borderColor =
            Color.lerp(
              KalloColors.borderBiscotti40,
              KalloColors.borderAccent40,
              t,
            )!;
        // Interpolate the input glow opacity (resting → focus).
        final glow = BoxShadow(
          color: KalloColors.accent.withValues(alpha: 0.06 + t * 0.06),
          blurRadius: 20,
          offset: const Offset(0, 4),
        );
        return Container(
          // No padding here — the notice sets its own inset, so the field and
          // controls carry theirs on the column below.
          decoration: BoxDecoration(
            // Opaque: the feed reads through the DOCK, never through the field.
            color: KalloColors.elev,
            borderRadius: BorderRadius.circular(KalloRadii.containerLg),
            border: Border.all(color: borderColor),
            // Ink contact + ambient under the accent glow — what lifts the
            // card off the feed scrolling behind it.
            boxShadow: [KalloShadows.md, KalloShadows.xs, glow],
          ),
          child: child,
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Inset on its own rounded block, sitting within the card rather
          // than spanning it — the card's border stays visible all the way
          // around it.
          if (widget.notice != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                KalloSpacing.sp1,
                KalloSpacing.sp1,
                KalloSpacing.sp1,
                0,
              ),
              child: widget.notice!,
            ),
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
                    cursorColor: KalloColors.accent,
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
                const SizedBox(height: KalloSpacing.sp2),
                // Line 2 — mode selector on the left, send/stop on the right.
                Row(
                  children: [
                    if (widget.onModePressed != null && !widget.analyzing)
                      ComposerModeButton(
                        icon: widget.modeIcon ?? LucideIcons.zap300,
                        label:
                            widget.modeLabel ??
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
                        icon: LucideIcons.square300, // lucide Square (filled)
                        iconSize: LoggingIcons.size,
                        label: 'common.cancel'.tr(),
                        onTap: widget.onCancel,
                      )
                    else
                      ComposerActionButton(
                        icon: LucideIcons.arrowUp300, // lucide ArrowUp
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
