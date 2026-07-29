import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';

/// Solid-umber primary pill for the terminal feed cards — currently the
/// failed-attempt "Try again". Icon + label, a pressed-state
/// [AnimatedContainer] that deepens the shadow, and an optional [busy] state
/// that dims to 0.5 and swallows taps (an in-flight resubmit). The resting look
/// mirrors the confirm button.
class TerminalPrimaryButton extends StatefulWidget {
  const TerminalPrimaryButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.busy = false,
  });

  final IconData icon;

  /// Already-translated string used for both the visible text and the Semantics
  /// label.
  final String label;
  final VoidCallback onTap;

  /// While true the pill dims and ignores taps.
  final bool busy;

  @override
  State<TerminalPrimaryButton> createState() => _TerminalPrimaryButtonState();
}

class _TerminalPrimaryButtonState extends State<TerminalPrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: !widget.busy,
      label: widget.label,
      child: Opacity(
        opacity: widget.busy ? 0.5 : 1,
        child: GestureDetector(
          onTapDown:
              widget.busy ? null : (_) => setState(() => _pressed = true),
          onTapUp:
              widget.busy ? null : (_) => setState(() => _pressed = false),
          onTapCancel:
              widget.busy ? null : () => setState(() => _pressed = false),
          onTap: widget.busy ? null : widget.onTap,
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
                Icon(widget.icon, size: 14, color: Colors.white),
                const SizedBox(width: 6),
                Text(
                  widget.label,
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

/// Quiet transparent "Discard" shared by the terminal feed cards — a hover-tint
/// on press, no fill at rest. Wires the shared logging.discard string.
class TerminalDiscardButton extends StatefulWidget {
  const TerminalDiscardButton({super.key, required this.onTap});
  final VoidCallback onTap;

  @override
  State<TerminalDiscardButton> createState() => _TerminalDiscardButtonState();
}

class _TerminalDiscardButtonState extends State<TerminalDiscardButton> {
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
          child: Text(
            'logging.discard'.tr(),
            style: dashBody(color: kInkMuted, weight: FontWeight.w500),
          ),
        ),
      ),
    );
  }
}
