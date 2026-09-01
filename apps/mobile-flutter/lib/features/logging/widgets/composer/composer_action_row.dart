/// The composer's second line: the mode pill on the left, the scan trigger and
/// send/stop clustered on the right.
///
/// Split out of meal_input.dart so that file stays about the field itself, and
/// carries the pill it is the only renderer of.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';
import 'meal_input_controls.dart';

/// Mode on the left; scan and send share the right edge.
///
/// Scan sits immediately LEFT of send (the reference composer's mic/send pair)
/// rather than beside the mode name: both are things you do with what is in
/// the field, so they belong to the same cluster. Mode and scan both withdraw
/// while an analysis runs — neither applies to a request already in flight.
class ComposerActionRow extends StatelessWidget {
  const ComposerActionRow({
    super.key,
    required this.analyzing,
    required this.canSubmit,
    required this.modeIcon,
    required this.modeLabel,
    required this.modeDetail,
    required this.onModePressed,
    required this.onBarcodePressed,
    required this.onCancel,
    required this.onSubmit,
  });

  final bool analyzing;
  final bool canSubmit;
  final IconData? modeIcon;
  final String? modeLabel;
  final String? modeDetail;
  final VoidCallback? onModePressed;
  final VoidCallback? onBarcodePressed;
  final VoidCallback? onCancel;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (onModePressed != null && !analyzing)
          ComposerModeButton(
            icon: modeIcon ?? LucideIcons.zap300,
            label: modeLabel ?? 'logging.modeSelector.button'.tr(),
            detail: modeDetail,
            onTap: onModePressed!,
          ),
        const Spacer(),
        if (onBarcodePressed != null && !analyzing)
          ComposerBarcodeButton(onTap: onBarcodePressed!),
        if (!canSubmit && analyzing && onCancel != null)
          ComposerActionButton(
            icon: LucideIcons.square300, // lucide Square (filled)
            label: 'common.cancel'.tr(),
            onTap: onCancel,
          )
        else
          ComposerActionButton(
            icon: LucideIcons.arrowUp400, // lucide ArrowUp
            label: 'logging.submit'.tr(),
            enabled: canSubmit,
            onTap: canSubmit ? onSubmit : null,
          ),
      ],
    );
  }
}

/// The mode control on the input bar's second line — a minimal icon + label
/// (no border, no chevron), like the Claude composer's "Auto". Tapping opens the
/// mode chooser. 44pt tap target, scales 0.96 on press.
class ComposerModeButton extends StatefulWidget {
  const ComposerModeButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.detail,
  });

  final IconData icon;
  final String label;

  /// A qualifier the mode carries — cheat's intensity ("Medium"). Set in the
  /// SAME size and weight as [label] and separated only by colour, the way the
  /// Claude composer reads "Sonnet 5 Medium": the mode is the state, the
  /// qualifier is a detail of it. Null on modes that have none.
  final String? detail;

  final VoidCallback onTap;

  @override
  State<ComposerModeButton> createState() => _ComposerModeButtonState();
}

class _ComposerModeButtonState extends State<ComposerModeButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final detail = widget.detail;
    return Semantics(
      button: true,
      label: detail == null ? widget.label : '${widget.label} $detail',
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
                    Icon(
                      widget.icon,
                      size: LoggingIcons.size,
                      color: KalloColors.text,
                    ),
                    const SizedBox(width: 6),
                    // Ink at 500: this names the mode the next send will use —
                    // state to read at a glance, not a hint. The detail rides
                    // in the same run of text so the two read as one label.
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: widget.label,
                            style: dashBody(weight: FontWeight.w500),
                          ),
                          if (detail != null)
                            TextSpan(
                              text: ' $detail',
                              style: dashBody(
                                weight: FontWeight.w500,
                                color: kInkMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
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
