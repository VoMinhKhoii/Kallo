import 'dart:async';

import 'package:flutter/material.dart';

import 'top_toast_pill.dart';

// The tone enum lives with the pill that renders it; re-exported so callers
// keep importing one file for `showTopToast` + `TopToastVariant`.
export 'top_toast_pill.dart' show TopToastVariant;

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

/// The toast's lifecycle: slide+fade in, hold for [duration], leave. The pill
/// it wraps is presentational only ([TopToastPill]).
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

    final content = FadeTransition(
      opacity: _c,
      child: SlideTransition(
        position: _slide,
        child: Align(
          alignment: Alignment.topCenter,
          child: TopToastPill(
            message: widget.message,
            variant: widget.variant,
            actionLabel: widget.actionLabel,
            onAction: _onAction,
          ),
        ),
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
