import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// Primary "Send" — solid umber, mirroring the confirm/try-again buttons.
class ClarifySendButton extends StatefulWidget {
  const ClarifySendButton({
    super.key,
    required this.disabled,
    required this.onTap,
  });
  final bool disabled;
  final VoidCallback onTap;

  @override
  State<ClarifySendButton> createState() => _ClarifySendButtonState();
}

class _ClarifySendButtonState extends State<ClarifySendButton> {
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
class ClarifyDiscardButton extends StatefulWidget {
  const ClarifyDiscardButton({super.key, required this.onTap});
  final VoidCallback onTap;

  @override
  State<ClarifyDiscardButton> createState() => _ClarifyDiscardButtonState();
}

class _ClarifyDiscardButtonState extends State<ClarifyDiscardButton> {
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
