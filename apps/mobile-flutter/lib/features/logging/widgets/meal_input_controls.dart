/// The three controls on the composer's second line: the mode chooser, the
/// one-tap barcode trigger, and the send/stop button.
///
/// Split out of meal_input.dart so that file stays about the field itself.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/logging_spacing.dart';

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
  State<ComposerModeButton> createState() => ComposerModeButtonState();
}

class ComposerModeButtonState extends State<ComposerModeButton> {
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
                padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp1),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(widget.icon,
                        size: LoggingIcons.size, color: NhamColors.btn),
                    const SizedBox(width: 6),
                    // Regular weight, same as the field's own text.
                    Text(widget.label, style: dashBody(color: kInkMuted)),
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
  State<ComposerBarcodeButton> createState() => ComposerBarcodeButtonState();
}

class ComposerBarcodeButtonState extends State<ComposerBarcodeButton> {
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
                LucideIcons.scanBarcode,
                size: LoggingIcons.size,
                color: NhamColors.btn,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The 32x32, rounded-md, btn-umber submit/stop button. Pressed → scale 0.95 +
/// btn-hover bg (RN `active:bg-nham-btn-hover active:scale-95`). Disabled → 0.3.
class ComposerActionButton extends StatefulWidget {
  const ComposerActionButton({
    super.key,
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
  State<ComposerActionButton> createState() => ComposerActionButtonState();
}

class ComposerActionButtonState extends State<ComposerActionButton> {
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
