import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// Precise-mode clarify prompt, rendered as a feed card. The pipeline finished
/// but an ingredient's portion/food couldn't be resolved, so the server asked
/// ONE targeted question and staged nothing. The user types a short answer and
/// re-submits the SAME meal with `clarifyAnswer` (reusing the attempt id).
///
/// Mirrors the cheat-clarify card's shape (raw input quote + question) and the
/// failed-attempt card's answer/resubmit mechanics — here the answer is free
/// text (the precise path carries no option chips).
class PreciseClarifyCard extends StatefulWidget {
  const PreciseClarifyCard({
    super.key,
    required this.rawInput,
    required this.question,
    required this.onSubmit,
    required this.onDiscard,
    this.busy = false,
  });

  final String rawInput;
  final String question;

  /// Re-submit the meal with the typed answer.
  final ValueChanged<String> onSubmit;

  /// Drop the clarify card (the raw text stays in the composer to re-log).
  final VoidCallback onDiscard;
  final bool busy;

  @override
  State<PreciseClarifyCard> createState() => _PreciseClarifyCardState();
}

class _PreciseClarifyCardState extends State<PreciseClarifyCard> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submit() {
    final answer = _controller.text.trim();
    if (answer.isEmpty || widget.busy) return;
    HapticFeedback.selectionClick();
    widget.onSubmit(answer);
  }

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(NhamRadii.containerLg),
    borderSide: BorderSide(color: color),
  );

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(NhamSpacing.sp4),
            decoration: BoxDecoration(
              color: NhamColors.elev,
              borderRadius: BorderRadius.circular(NhamRadii.containerLg),
              border: Border.all(color: NhamColors.borderSoft),
              boxShadow: const [NhamShadows.sm],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.rawInput.isNotEmpty) ...[
                  NhamText(
                    widget.rawInput,
                    variant: NhamTextVariant.mealQuote,
                    style: const TextStyle(fontSize: 17, height: 1.625),
                  ),
                  const SizedBox(height: NhamSpacing.sp3),
                ],
                // The AI's single targeted question (already localized server-side).
                NhamText(
                  widget.question,
                  variant: NhamTextVariant.body,
                  style: dashBody(),
                ),
                const SizedBox(height: NhamSpacing.sp3),
                TextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  autofocus: true,
                  enabled: !widget.busy,
                  style: dashBody(),
                  cursorColor: NhamColors.accent,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: 'logging.clarify.answerHint'.tr(),
                    hintStyle: dashBody(color: kInkMuted),
                    filled: true,
                    fillColor: NhamColors.elev,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: NhamSpacing.sp3,
                      vertical: NhamSpacing.sp3,
                    ),
                    border: _border(NhamColors.inputBorder),
                    enabledBorder: _border(NhamColors.inputBorder),
                    focusedBorder: _border(NhamColors.borderAccent40),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          Row(
            children: [
              Expanded(child: _SendButton(disabled: widget.busy, onTap: _submit)),
              const SizedBox(width: NhamSpacing.sp2),
              _DiscardButton(onTap: widget.onDiscard),
            ],
          ),
        ],
      ),
    );
  }
}

/// Primary "Send" — solid umber, mirroring the confirm/try-again buttons.
class _SendButton extends StatefulWidget {
  const _SendButton({required this.disabled, required this.onTap});
  final bool disabled;
  final VoidCallback onTap;

  @override
  State<_SendButton> createState() => _SendButtonState();
}

class _SendButtonState extends State<_SendButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: !widget.disabled,
      label: 'logging.clarify.send'.tr(),
      child: Opacity(
        opacity: widget.disabled ? 0.5 : 1,
        child: GestureDetector(
          onTapDown:
              widget.disabled ? null : (_) => setState(() => _pressed = true),
          onTapUp:
              widget.disabled ? null : (_) => setState(() => _pressed = false),
          onTapCancel:
              widget.disabled ? null : () => setState(() => _pressed = false),
          onTap: widget.disabled ? null : widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            decoration: BoxDecoration(
              color: _pressed ? NhamColors.btnHover : NhamColors.btn,
              borderRadius: BorderRadius.circular(NhamRadii.xl),
              boxShadow: [_pressed ? NhamShadows.md : NhamShadows.sm],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  LucideIcons.cornerDownLeft,
                  size: 14,
                  color: Colors.white,
                ),
                const SizedBox(width: 6),
                NhamText(
                  'logging.clarify.send'.tr(),
                  variant: NhamTextVariant.body,
                  style: dashBody(color: Colors.white, weight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Quiet "Discard" — reuses the shared logging.discard string.
class _DiscardButton extends StatefulWidget {
  const _DiscardButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_DiscardButton> createState() => _DiscardButtonState();
}

class _DiscardButtonState extends State<_DiscardButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.discard'.tr(),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.xl),
          ),
          child: NhamText(
            'logging.discard'.tr(),
            variant: NhamTextVariant.body,
            style: dashBody(color: kInkMuted, weight: FontWeight.w500),
          ),
        ),
      ),
    );
  }
}
