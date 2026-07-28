import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/calm_tokens.dart';
import '../../theme/nham_colors.dart';
import '../../theme/nham_theme.dart';

/// A top-toast's tone — sets the leading icon + its color.
enum TopToastVariant { success, error }

/// Show a brief toast pinned to the TOP of the screen (matches the web's
/// top-anchored toasts) — a white pill that slides+fades in, holds, then leaves.
/// Used for save confirmations, quiet acknowledgements, and error notices
/// (`variant: TopToastVariant.error`).
///
/// When [actionLabel] is given the pill becomes interactive (e.g. an "Undo"
/// affordance) and holds for [duration]. The returned future completes when the
/// toast is gone — by tap, timeout, or the action — mirroring the Material
/// `SnackBar.closed` future so callers can finalize work on dismissal.
Future<void> showTopToast(
  BuildContext context,
  String message, {
  TopToastVariant variant = TopToastVariant.success,
  String? actionLabel,
  VoidCallback? onAction,
  Duration duration = const Duration(milliseconds: 2200),
}) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return Future<void>.value();
  final completer = Completer<void>();
  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => _TopToast(
      message: message,
      variant: variant,
      actionLabel: actionLabel,
      onAction: onAction,
      duration: duration,
      onDone: () {
        if (entry.mounted) entry.remove();
        if (!completer.isCompleted) completer.complete();
      },
    ),
  );
  overlay.insert(entry);
  return completer.future;
}

class _TopToast extends StatefulWidget {
  const _TopToast({
    required this.message,
    required this.variant,
    required this.actionLabel,
    required this.onAction,
    required this.duration,
    required this.onDone,
  });

  final String message;
  final TopToastVariant variant;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Duration duration;
  final VoidCallback onDone;

  @override
  State<_TopToast> createState() => _TopToastState();
}

class _TopToastState extends State<_TopToast>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  );
  late final Animation<Offset> _slide = Tween<Offset>(
    begin: const Offset(0, -0.4),
    end: Offset.zero,
  ).animate(CurvedAnimation(parent: _c, curve: Curves.easeOutCubic));

  Timer? _hold;

  @override
  void initState() {
    super.initState();
    _c.forward();
    _hold = Timer(widget.duration, _dismiss);
  }

  Future<void> _dismiss() async {
    if (!mounted) return;
    _hold?.cancel();
    await _c.reverse();
    widget.onDone();
  }

  void _onAction() {
    widget.onAction?.call();
    _dismiss();
  }

  @override
  void dispose() {
    _hold?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasAction = widget.actionLabel != null;

    final pill = Container(
      margin: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp3,
        vertical: NhamSpacing.sp2,
      ),
      // 16 horizontal / 12 vertical — the same optical card inset the rest of
      // the app uses; the action side gives back half so the tappable label
      // sits on the pill's edge without the row reading lopsided.
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp3,
        hasAction ? NhamSpacing.sp2 : NhamSpacing.sp4,
        NhamSpacing.sp3,
      ),
      decoration: BoxDecoration(
        // Solid white, not the retired cream — #FFFCF8 read yellow against
        // the neutral #F9F9F7 canvas.
        color: kCardSurface,
        borderRadius: BorderRadius.circular(NhamRadii.pill),
        border: Border.all(color: kHairline),
        boxShadow: kCardShadows,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            widget.variant == TopToastVariant.error
                ? LucideIcons.circleAlert
                : LucideIcons.check,
            // Status colour rides the icon, never the copy.
            size: 16,
            color: widget.variant == TopToastVariant.error
                ? NhamColors.danger
                : kInk,
          ),
          const SizedBox(width: NhamSpacing.sp2),
          Flexible(
            child: Text(
              widget.message,
              textAlign: hasAction ? TextAlign.left : TextAlign.center,
              style: dashBody(),
            ),
          ),
          if (hasAction) ...[
            const SizedBox(width: NhamSpacing.sp2),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _onAction,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: NhamSpacing.sp2,
                  vertical: NhamSpacing.sp1,
                ),
                // Medium is the weight ceiling — semibold read thick in
                // Be Vietnam Pro.
                child: Text(
                  widget.actionLabel!,
                  style: dashBody(weight: FontWeight.w500),
                ),
              ),
            ),
          ],
        ],
      ),
    );

    final content = FadeTransition(
      opacity: _c,
      child: SlideTransition(
        position: _slide,
        child: Align(alignment: Alignment.topCenter, child: pill),
      ),
    );

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        // Non-action toasts never eat taps; action toasts must be tappable.
        child: hasAction ? content : IgnorePointer(child: content),
      ),
    );
  }
}
