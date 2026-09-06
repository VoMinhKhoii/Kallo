import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';

/// The confirm dialog's actions: full-width 44pt TEXT rows, stacked, each one
/// separated from the content above it by a 0.5pt hairline.
///
/// **2026-09-03, second pass (user reference: Instagram's iOS "Delete post?"
/// alert): the filled pills are retired.** The first pass answered "which one
/// is safe" with a red-filled affirmative over a ghost cancel, which read as an
/// app card wearing an alert's chrome — no iOS alert on the phone this dialog
/// opens over paints a fill behind an action. The anatomy is the platform's
/// now: hairline, destructive verb in red, hairline, safe verb in ink. What
/// carries over unchanged is the STACK — [CupertinoAlertDialog] would sit two
/// short verbs side by side across a vertical hairline, and two short
/// Vietnamese words on one line is exactly the ambiguity the stack fixed.
///
/// The labels stay explicit verbs ("Xoá" / "Giữ lại"), so the safe option is
/// something the user reads to ACT: ink, never muted (mobile.md).
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

  /// Paints the affirmative red. Reserved for what the palette reserves it for:
  /// "this destroys something", never "your numbers are off".
  final bool destructive;

  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const KalloAlertHairline(),
        KalloAlertAction(
          label: confirmLabel,
          // Instagram's "Delete" is red AND bold: emphasis is the default
          // action's, colour is the destructive one's. A non-destructive
          // affirmative keeps the weight and drops the red.
          color: destructive ? KalloColors.danger : kInk,
          weight: FontWeight.w600,
          // The one moment worth a firmer tap than a selection click: past this
          // point something is gone.
          onTap: () {
            HapticFeedback.mediumImpact();
            onConfirm();
          },
        ),
        const KalloAlertHairline(),
        KalloAlertAction(
          label: cancelLabel,
          color: kInk,
          weight: FontWeight.w400,
          onTap: onCancel,
        ),
      ],
    );
  }
}

/// The 0.5pt rule an iOS alert draws between its content and every action, and
/// between one action and the next. Half a logical pixel, not one: at 3x it is
/// the same 1.5 device pixels the system draws.
class KalloAlertHairline extends StatelessWidget {
  const KalloAlertHairline({super.key});

  @override
  Widget build(BuildContext context) =>
      Container(height: 0.5, color: kHairline);
}

/// One alert action: a full-width, centred, 44pt-minimum text row that washes
/// on press. No fill, no radius — the row IS the button, which is why the
/// hairlines above and below it are what separate it from its neighbours.
class KalloAlertAction extends StatefulWidget {
  const KalloAlertAction({
    super.key,
    required this.label,
    required this.color,
    required this.weight,
    required this.onTap,
  });

  final String label;
  final Color color;
  final FontWeight weight;
  final VoidCallback onTap;

  @override
  State<KalloAlertAction> createState() => _KalloAlertActionState();
}

class _KalloAlertActionState extends State<KalloAlertAction> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        // Animated, not a bare Container: every other quiet button in the app
        // crossfades its wash rather than snapping it on.
        child: AnimatedContainer(
          duration: KalloMotion.press,
          curve: KalloEase.press,
          alignment: Alignment.center,
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp4,
            vertical: KalloSpacing.sp2,
          ),
          color: _pressed ? KalloColors.hover : const Color(0x00000000),
          child: Text(
            widget.label,
            textAlign: TextAlign.center,
            style: dashBody(color: widget.color, weight: widget.weight),
          ),
        ),
      ),
    );
  }
}
