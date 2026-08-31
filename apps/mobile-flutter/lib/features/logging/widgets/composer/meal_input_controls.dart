/// The three controls on the composer's second line: the mode chooser, the
/// one-tap barcode trigger, and the send/stop button.
///
/// Split out of meal_input.dart so that file stays about the field itself.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';

/// The mode control on the input bar's second line — a minimal icon + label
/// (no border, no chevron), like the Claude composer's "Auto". Tapping opens the
/// mode chooser. 44pt tap target, scales 0.96 on press.
class ComposerModeButton extends StatefulWidget {
  const ComposerModeButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  State<ComposerModeButton> createState() => _ComposerModeButtonState();
}

class _ComposerModeButtonState extends State<ComposerModeButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: SizedBox(
          height: 44, // HIG tap target
          child: Center(
            child: AnimatedScale(
              scale: _pressed ? 0.96 : 1,
              duration: const Duration(milliseconds: 200),
              child: Padding(
                // No left inset: the mode mark lines up with the field's text
                // above it, and the composer card's own 16 is the gutter.
                padding: const EdgeInsets.only(right: KalloSpacing.sp2_5),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(widget.icon,
                        size: LoggingIcons.size, color: KalloColors.text),
                    const SizedBox(width: 6),
                    // Ink at 500: this names the mode the next send will use —
                    // state to read at a glance, not a hint.
                    Text(widget.label, style: dashBody(weight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Icon-only barcode trigger beside the mode control — same quiet styling,
/// 44pt tap target.
class ComposerBarcodeButton extends StatefulWidget {
  const ComposerBarcodeButton({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  State<ComposerBarcodeButton> createState() => _ComposerBarcodeButtonState();
}

class _ComposerBarcodeButtonState extends State<ComposerBarcodeButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.barcode.title'.tr(),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap();
        },
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: AnimatedScale(
              scale: _pressed ? 0.96 : 1,
              duration: const Duration(milliseconds: 200),
              child: const Icon(
                LucideIcons.scanBarcode300,
                size: 20,
                color: KalloColors.textMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The send / stop button: a 32pt circle in a 44pt tap target (Log artboard).
/// Armed it wears the beige in-app primary wash with an ink glyph, like the
/// sent bubble and the confirm circle; unarmed it drops to the track grey
/// rather than to a dimmed copy of itself — "nothing to send yet" is a resting
/// state, not a failure.
class ComposerActionButton extends StatefulWidget {
  const ComposerActionButton({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.enabled = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  State<ComposerActionButton> createState() => _ComposerActionButtonState();
}

class _ComposerActionButtonState extends State<ComposerActionButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final tappable = widget.onTap != null;
    final armed = widget.enabled && tappable;
    return Semantics(
      button: true,
      enabled: tappable,
      label: widget.label,
      child: GestureDetector(
        onTapDown: tappable ? (_) => setState(() => _pressed = true) : null,
        onTapUp: tappable ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: tappable ? () => setState(() => _pressed = false) : null,
        onTap: widget.onTap,
        // 44pt minimum tap target (HIG) around the visual button.
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: AnimatedScale(
              scale: _pressed ? 0.95 : 1,
              duration: const Duration(
                milliseconds: 200,
              ), // transition-all duration-200
              child: Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  // The press is carried by the scale above, not by a second
                  // fill: beige has nowhere lighter to go on white.
                  color:
                      armed ? KalloColors.btnPrimarySoft : KalloColors.track,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  widget.icon,
                  size: 18,
                  color: armed ? KalloColors.text : KalloColors.textMuted,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
