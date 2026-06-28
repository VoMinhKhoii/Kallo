import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/nham_colors.dart';
import '../../theme/nham_theme.dart';
import '../../theme/nham_typography.dart';

/// Show a brief toast pinned to the TOP of the screen (matches the web's
/// top-anchored toasts) — a cream pill that slides+fades in, holds, then leaves.
/// Used for save confirmations and other quiet acknowledgements.
void showTopToast(BuildContext context, String message) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (_) => _TopToast(
      message: message,
      onDone: () {
        if (entry.mounted) entry.remove();
      },
    ),
  );
  overlay.insert(entry);
}

class _TopToast extends StatefulWidget {
  const _TopToast({required this.message, required this.onDone});

  final String message;
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
    _hold = Timer(const Duration(milliseconds: 2200), _dismiss);
  }

  Future<void> _dismiss() async {
    if (!mounted) return;
    await _c.reverse();
    widget.onDone();
  }

  @override
  void dispose() {
    _hold?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: IgnorePointer(
          child: FadeTransition(
            opacity: _c,
            child: SlideTransition(
              position: _slide,
              child: Align(
                alignment: Alignment.topCenter,
                child: Container(
                  margin: const EdgeInsets.symmetric(
                    horizontal: NhamSpacing.sp4,
                    vertical: NhamSpacing.sp2,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: NhamSpacing.sp4,
                    vertical: NhamSpacing.sp3,
                  ),
                  decoration: BoxDecoration(
                    color: NhamColors.cardCream,
                    borderRadius: BorderRadius.circular(NhamRadii.pill),
                    border: Border.all(color: NhamColors.border),
                    boxShadow: const [NhamShadows.md],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        LucideIcons.check,
                        size: 16,
                        color: NhamColors.accent,
                      ),
                      const SizedBox(width: NhamSpacing.sp2),
                      Flexible(
                        child: Text(
                          widget.message,
                          textAlign: TextAlign.center,
                          style: NhamTextStyles.sansMedium(
                            fontSize: NhamFontSize.sm,
                          ).copyWith(color: NhamColors.text),
                        ),
                      ),
                    ],
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
