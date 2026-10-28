import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_palette.dart';
import '../../../theme/kallo_theme.dart';
import '../surface/kallo_pressable.dart';
import 'kallo_alert_surface.dart';

/// The confirm dialog's actions: the iOS 26 alert's pills.
///
/// **2026-10-28 (user decision): the iOS 26 in-app alert, minus Liquid
/// Glass**, measured off a real `UIAlertController` on the iOS 26.3 simulator.
/// It replaces the pre-26 anatomy (hairline-divided text rows) this dialog
/// took from Instagram's alert on 2026-09-03. What the system does, and so
/// what this does:
///
/// - A non-destructive answer is a FILLED blue pill with a white label — the
///   one filled shape in the alert, so the answer is never in doubt.
/// - A destructive answer is NOT filled: red label on the same grey pill the
///   cancel wears. Red means "this destroys something" (the palette's rule),
///   and the system keeps it to the label.
/// - The cancel is ink on grey.
/// - Two labels that both fit half the row sit side by side, cancel on the
///   left. Either one too long stacks them full width, the answer on top.
class KalloConfirmActions extends StatelessWidget {
  const KalloConfirmActions({
    super.key,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.destructive,
    required this.onConfirm,
    required this.onCancel,
  });

  final String confirmLabel;
  final String cancelLabel;

  /// Paints the affirmative's label red. Reserved for what the palette
  /// reserves it for: "this destroys something", never "your numbers are off".
  final bool destructive;

  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final confirm = KalloAlertAction(
      label: confirmLabel,
      fill: destructive ? kAlertPillFill : kAlertActionBlue,
      color: destructive ? KalloColors.danger : const Color(0xFFFFFFFF),
      // The one moment worth a firmer tap than a selection click.
      onTap: () {
        HapticFeedback.mediumImpact();
        onConfirm();
      },
    );
    final cancel = KalloAlertAction(
      label: cancelLabel,
      fill: kAlertPillFill,
      color: kInk,
      onTap: onCancel,
    );

    return LayoutBuilder(
      builder: (context, box) {
        final half = (box.maxWidth - kKalloAlertActionGap) / 2;
        final scaler = MediaQuery.textScalerOf(context);
        final fits = [
          confirmLabel,
          cancelLabel,
        ].every((label) => KalloAlertAction.widthOf(label, scaler) <= half);
        if (fits) {
          return Row(
            children: [
              Expanded(child: cancel),
              const SizedBox(width: kKalloAlertActionGap),
              Expanded(child: confirm),
            ],
          );
        }
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            confirm,
            const SizedBox(height: kKalloAlertActionGap),
            cancel,
          ],
        );
      },
    );
  }
}

/// The system alert's tint, the blue its answer pill is filled with: iOS 26's
/// `systemBlue` (#0088FF light, #0091FF dark — sampled off the simulator),
/// resolved against the app's palette rather than the platform brightness,
/// since the palette owns light and dark.
Color get kAlertActionBlue =>
    KalloPalette.current.isDark
        ? const Color(0xFF0091FF)
        : const Color(0xFF0088FF);

/// The grey pill behind the cancel and a destructive answer: ink at 10% over
/// the card — the step the system's grey pill sits below its card (239→210).
Color get kAlertPillFill => kInk.withValues(alpha: 0.10);

/// One alert action: a stadium pill, 48pt tall, that washes on press.
///
/// **The hold (2026-09-07).** The pill behaves exactly as the platform's own
/// alert action does: the wash lasts the ENTIRE hold and the action FIRES on
/// release (`mobile.md`, *Platform — Cupertino wherever it exists*, boundary
/// 2: the platform wins on behaviour). [KalloPressable] takes the press state
/// out of the gesture arena so no arena resolution can cancel the wash, and it
/// paints the wash ([KalloColors.pressWash], ink at 6%) OVER the fill, so a
/// held pill darkens rather than being repainted.
class KalloAlertAction extends StatelessWidget {
  const KalloAlertAction({
    super.key,
    required this.label,
    required this.fill,
    required this.color,
    required this.onTap,
  });

  final String label;
  final Color fill;
  final Color color;
  final VoidCallback onTap;

  static const double _padX = KalloSpacing.sp4;

  /// The width a pill needs to show [label] on one line, padding included.
  static double widthOf(String label, TextScaler scaler) {
    final painter = TextPainter(
      text: TextSpan(text: label, style: kButtonLabel()),
      textDirection: TextDirection.ltr,
      textScaler: scaler,
      maxLines: 1,
    )..layout();
    final width = painter.width + 2 * _padX;
    painter.dispose();
    return width;
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(kKalloAlertActionHeight / 2),
        child: ColoredBox(
          color: fill,
          child: KalloPressable(
            onTap: onTap,
            alignment: Alignment.center,
            constraints: const BoxConstraints(
              minHeight: kKalloAlertActionHeight,
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: _padX,
              vertical: KalloSpacing.sp2,
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: kButtonLabel(color: color),
            ),
          ),
        ),
      ),
    );
  }
}
