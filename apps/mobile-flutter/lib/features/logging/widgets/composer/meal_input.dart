import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';
import 'composer_card_surface.dart';
import 'composer_action_row.dart';
import '../relog/mention_text_controller.dart';

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
/// Ported 1:1 from web `components/logging/input/composer/meal-input.tsx`.
class MealInput extends StatefulWidget {
  const MealInput({
    super.key,
    required this.controller,
    required this.onSubmit,
    this.onCancel,
    this.onModePressed,
    this.onBarcodePressed,
    this.modeLabel,
    this.modeDetail,
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

  /// While true the action button shows Stop — but the field stays editable so
  /// a new meal can be typed mid-analysis (requestId-supersede handles it).
  final bool analyzing;

  /// Opens the mode selector (Normal / Cheat meal / Manual). Rendered as an
  /// icon + label on the input bar's second line.
  final VoidCallback? onModePressed;

  /// One-tap barcode scanning next to the mode control — frequent enough to
  /// skip the mode-sheet detour.
  final VoidCallback? onBarcodePressed;

  /// Label + icon of the currently selected mode, shown on the mode control.
  final String? modeLabel;
  final IconData? modeIcon;

  /// The muted qualifier trailing [modeLabel] — cheat's intensity. Null for
  /// modes that carry none, which then render as the bare mode name.
  final String? modeDetail;

  /// Placeholder override — cheat mode swaps in the occasion-flavored hint.
  final String? hintText;

  /// An optional band pinned across the TOP of the card, inside its border and
  /// clipped by its radius — currently the under-logged-day note. Inside
  /// rather than above, so message and remedy read as one object.
  final Widget? notice;

  /// The field's text controller, supplied when the caller needs to read or
  /// tint what is in it — the feed passes its [MentionTextEditingController] so
  /// relog picks render as tinted runs in the real field. Omitted (the
  /// quick-log sheet), the composer owns a plain one.
  final MentionTextEditingController? textController;

  /// Fired whenever the value OR the caret may have moved — the relog picker
  /// keys off the token left of a caret that moves without the text changing.
  final VoidCallback? onSync;

  /// Content stacked above the whole card — the `/` picker, outside the card's
  /// border, the way it floats over the composer on the web.
  final Widget? popupSlot;

  @override
  State<MealInput> createState() => _MealInputState();
}

class _MealInputState extends State<MealInput>
    with SingleTickerProviderStateMixin {
  /// One line, growing to about eight before the field scrolls itself.
  static const _fieldBox = BoxConstraints(minHeight: 24, maxHeight: 200);

  /// Body — typed at the size it will be read back at in the feed.
  static final _fieldText = dashBody();

  /// Owned only when the caller didn't supply one — disposing a borrowed
  /// controller would break the feed the moment the composer rebuilt.
  ///
  /// INVARIANT: a caller supplies [MealInput.textController] for this widget's
  /// whole life or never at all. `late final` bakes that in — starting at null
  /// and passing one later would strand this undisposed, since [dispose] frees
  /// it only while `_ownsController` holds. The feed owns one for the life of
  /// the screen; the quick-log sheet passes none.
  late final MentionTextEditingController _ownedController =
      MentionTextEditingController();
  bool _ownsController = false;

  MentionTextEditingController get _controller =>
      widget.textController ?? _ownedController;

  final FocusNode _focusNode = FocusNode();

  // Border + shadow crossfade on focus — `emphasis` is the token for exactly
  // this ("a control changing shape: a field taking focus").
  late final AnimationController _focus = AnimationController(
    vsync: this,
    duration: KalloMotion.emphasis,
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
    // Move the listener with the controller, or a swapped-in field goes silent.
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

  /// One handler for every "value or caret may have moved" signal. Mentions are
  /// re-located FIRST, so a broken label has dropped its reference before the
  /// picker re-reads the token.
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
    if (!_canSubmit) return;
    HapticFeedback.lightImpact();
    // Drop the keyboard before the answer arrives: it covers half the feed, and
    // leaving focus put meant dismissing it yourself to read the reply. Every
    // flow that wants the field back asks (MealInputController.focus).
    _focusNode.unfocus();
    widget.onSubmit(_controller.text);
  }

  @override
  Widget build(BuildContext context) {
    // The slot is ALWAYS here, empty when the picker is closed: dropping it
    // changes this subtree's root type, so `Widget.canUpdate` fails and the
    // card is re-inflated — which closes the field's platform input connection
    // and leaves it waiting on a focus CHANGE that never comes, because the
    // FocusNode kept focus. That was `/` killing the keyboard.
    // Flexible only when there IS a picker: it is the half that yields room
    // under a bounded dock, and the quick-log sheet lays this out unbounded.
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.popupSlot == null)
          const SizedBox.shrink()
        else
          Flexible(child: widget.popupSlot!),
        _buildCard(context),
      ],
    );
  }

  Widget _buildCard(BuildContext context) {
    return ComposerCardSurface(
      focus: _focus,
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
                  constraints: _fieldBox,
                  child: TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    maxLines: null,
                    keyboardType: TextInputType.multiline,
                    textInputAction: TextInputAction.newline,
                    style: _fieldText,
                    cursorColor: KalloColors.accent,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      contentPadding: const EdgeInsets.fromLTRB(0, 8, 0, 6),
                      hintText:
                          widget.hintText ?? 'logging.composerPlaceholder'.tr(),
                      hintStyle: _fieldText.copyWith(color: kInkMuted),
                    ),
                  ),
                ),
                const SizedBox(height: KalloSpacing.sp0_5),
                // Line 2 — mode, scan, send.
                ComposerActionRow(
                  analyzing: widget.analyzing,
                  canSubmit: _canSubmit,
                  modeIcon: widget.modeIcon,
                  modeLabel: widget.modeLabel,
                  modeDetail: widget.modeDetail,
                  onModePressed: widget.onModePressed,
                  onBarcodePressed: widget.onBarcodePressed,
                  onCancel: widget.onCancel,
                  onSubmit: _submit,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
