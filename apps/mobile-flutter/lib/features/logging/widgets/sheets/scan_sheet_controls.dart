import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';

/// The three button shapes the scan sheet uses, shared by its barcode and
/// nutrition-label branches. Lifted out of `barcode_scanner_sheet.dart` when
/// the label branch needed the same chrome — one definition, not two that
/// drift.

/// Filled umber call-to-action. Scales down slightly while held.
class ScanPrimaryButton extends StatefulWidget {
  const ScanPrimaryButton({
    super.key,
    required this.label,
    required this.onTap,
    this.enabled = true,
    this.busy = false,
  });

  final String label;
  final VoidCallback onTap;

  /// Dimmed and inert when false — used for a review step that isn't yet
  /// submittable.
  final bool enabled;

  /// Swaps the label for a spinner while a request is in flight.
  final bool busy;

  @override
  State<ScanPrimaryButton> createState() => _ScanPrimaryButtonState();
}

class _ScanPrimaryButtonState extends State<ScanPrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final active = widget.enabled && !widget.busy;
    return Semantics(
      button: true,
      enabled: active,
      label: widget.label,
      child: GestureDetector(
        onTapDown: active ? (_) => setState(() => _pressed = true) : null,
        onTapUp: active ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: active ? () => setState(() => _pressed = false) : null,
        onTap: active
            ? () {
                HapticFeedback.lightImpact();
                widget.onTap();
              }
            : null,
        child: AnimatedScale(
          scale: _pressed ? 0.97 : 1,
          duration: const Duration(milliseconds: 150),
          child: Opacity(
            opacity: active ? 1 : 0.5,
            child: Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
              decoration: BoxDecoration(
                color: _pressed ? NhamColors.btnHover : NhamColors.btn,
                borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
              ),
              child: widget.busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      widget.label,
                      style: NhamTextStyles.sansSemiBold(
                        fontSize: NhamFontSize.sm,
                      ).copyWith(color: Colors.white),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Bordered secondary action on the elevated surface.
class ScanOutlineButton extends StatelessWidget {
  const ScanOutlineButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            border: Border.all(color: NhamColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: NhamColors.text),
              const SizedBox(width: 6),
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.text),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Chromeless tertiary action — a 44pt row of muted icon + label.
class ScanQuietButton extends StatelessWidget {
  const ScanQuietButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: SizedBox(
          height: 44,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: NhamColors.textMuted),
              const SizedBox(width: 6),
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
