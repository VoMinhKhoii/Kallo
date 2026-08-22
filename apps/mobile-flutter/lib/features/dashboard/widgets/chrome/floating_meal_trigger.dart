/// FloatingMealTrigger — Flutter port of the web mobile FAB
/// (`components/dashboard/today/meal-trigger.tsx` `FloatingMealTrigger`,
/// rendered under `md:hidden`).
///
/// A 44x44 FAB (radius 16, btn color, soft shadow, UtensilsCrossed icon) that
/// opens the quick-log SHEET — see `logging/widgets/sheets/quick_log_sheet.dart`
/// for why the composer lives in a sheet rather than in a bar hanging off this
/// button.
///
/// The FAB is *draggable* — the user can pick it up and drop it anywhere; on
/// release it snaps to the nearest left/right edge (the familiar "chat-head" /
/// movable-FAB pattern) at whatever height they left it, so it never sits over
/// content they care about. The chosen spot persists for the session via
/// [mealFabPositionProvider].
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../logging/widgets/sheets/quick_log_sheet.dart';

/// Session-scoped FAB position (top-left, in the dashboard content's local
/// coordinate space). Null → resolve to the default bottom-right resting spot.
/// Held in a provider so it survives tab switches and dashboard rebuilds.
final mealFabPositionProvider = StateProvider<Offset?>((ref) => null);

// FAB geometry / movement bounds.
const double _fabSize = 44; // h-11 w-11
const double _fabMargin = KalloSpacing.sp4; // 16 — edge inset
const double _fabBottomGap = KalloSpacing.sp5; // 20 — default bottom rest

class FloatingMealTrigger extends ConsumerStatefulWidget {
  const FloatingMealTrigger({super.key});

  @override
  ConsumerState<FloatingMealTrigger> createState() =>
      _FloatingMealTriggerState();
}

class _FloatingMealTriggerState extends ConsumerState<FloatingMealTrigger> {
  bool _fabPressed = false;
  bool _dragging = false;

  /// Live FAB position while the session value is being moved; falls back to the
  /// provider, then the default, resolved against the current bounds each build.
  Offset? _pos;

  void _open() {
    HapticFeedback.lightImpact();
    showQuickLogSheet(context, ref);
  }

  // ── Position helpers ───────────────────────────────────────────────────────

  Offset _defaultPos(double w, double h) =>
      Offset(w - _fabSize - _fabMargin, h - _fabSize - _fabBottomGap);

  Offset _clampPos(Offset p, double w, double h) {
    final maxX = (w - _fabSize - _fabMargin).clamp(_fabMargin, double.infinity);
    final maxY = (h - _fabSize - _fabBottomGap).clamp(
      _fabMargin,
      double.infinity,
    );
    return Offset(
      p.dx.clamp(_fabMargin, maxX).toDouble(),
      p.dy.clamp(_fabMargin, maxY).toDouble(),
    );
  }

  Offset _resolvePos(double w, double h) {
    final stored = _pos ?? ref.read(mealFabPositionProvider);
    return _clampPos(stored ?? _defaultPos(w, h), w, h);
  }

  void _onDragStart() {
    HapticFeedback.selectionClick(); // pick-up cue
    setState(() {
      _dragging = true;
      _fabPressed = true;
    });
  }

  void _onDragUpdate(Offset delta, double w, double h) {
    setState(() {
      _pos = _clampPos((_pos ?? _resolvePos(w, h)) + delta, w, h);
    });
  }

  void _onDragEnd(double w, double h) {
    final p = _pos ?? _resolvePos(w, h);
    // Snap to whichever vertical edge the FAB's center is closer to.
    final center = p.dx + _fabSize / 2;
    final snappedX = center < w / 2 ? _fabMargin : (w - _fabSize - _fabMargin);
    final snapped = _clampPos(Offset(snappedX, p.dy), w, h);
    setState(() {
      _pos = snapped;
      _dragging = false;
      _fabPressed = false;
    });
    ref.read(mealFabPositionProvider.notifier).state = snapped;
    HapticFeedback.lightImpact(); // settle cue
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight;
        final pos = _resolvePos(w, h);

        return SizedBox.expand(
          child: Stack(
            children: [
              // The draggable FAB.
              Positioned(
                left: pos.dx,
                top: pos.dy,
                width: _fabSize,
                height: _fabSize,
                child: Semantics(
                  button: true,
                  label: tr('dashboard.logMeal'),
                  child: GestureDetector(
                    onTapDown: (_) => setState(() => _fabPressed = true),
                    onTapUp: (_) => setState(() => _fabPressed = false),
                    onTapCancel: () => setState(() => _fabPressed = false),
                    onTap: _open,
                    // Drag to reposition; snaps to an edge on release.
                    onPanStart: (_) => _onDragStart(),
                    onPanUpdate: (d) => _onDragUpdate(d.delta, w, h),
                    onPanEnd: (_) => _onDragEnd(w, h),
                    child: AnimatedScale(
                      // Lift slightly while held — a tactile "picked up" feel.
                      scale: _dragging ? 1.12 : 1.0,
                      duration: const Duration(milliseconds: 150),
                      curve: Curves.easeOut,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color:
                              _fabPressed
                                  ? KalloColors.btnHover
                                  : KalloColors.btn,
                          borderRadius: BorderRadius.circular(
                            KalloRadii.containerLg,
                          ), // 16
                          boxShadow: [
                            // Deeper shadow while dragging reads as "above" the
                            // surface; resting shadow matches the web FAB.
                            BoxShadow(
                              color: const Color(0x2E141413), // ink @ 18%
                              blurRadius: _dragging ? 24 : 16,
                              offset: Offset(0, _dragging ? 8 : 4),
                            ),
                          ],
                        ),
                        child: const Icon(
                          LucideIcons.utensilsCrossed300,
                          size: KalloIcons.size,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
