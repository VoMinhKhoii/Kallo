/// FloatingMealTrigger — Flutter port of the web mobile FAB
/// (`components/dashboard/today/meal-trigger.tsx` `FloatingMealTrigger`,
/// rendered under `md:hidden`).
///
/// A 44x44 FAB (radius 16, btn color, soft shadow, UtensilsCrossed icon) that
/// expands into a compact meal-input bar (slide+fade in, 160ms). Submitting
/// navigates to `/logging?meal=…`.
///
/// The FAB is *draggable* — the user can pick it up and drop it anywhere; on
/// release it snaps to the nearest left/right edge (the familiar "chat-head" /
/// movable-FAB pattern) at whatever height they left it, so it never sits over
/// content they care about. The chosen spot persists for the session via
/// [mealFabPositionProvider]. The expanding input bar re-anchors above or below
/// the FAB depending on where it lives.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:go_router/go_router.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// Session-scoped FAB position (top-left, in the dashboard content's local
/// coordinate space). Null → resolve to the default bottom-right resting spot.
/// Held in a provider so it survives tab switches and dashboard rebuilds.
final mealFabPositionProvider = StateProvider<Offset?>((ref) => null);

// FAB geometry / movement bounds.
const double _fabSize = 44; // h-11 w-11
const double _fabMargin = NhamSpacing.sp4; // 16 — edge inset
const double _fabBottomGap = NhamSpacing.sp5; // 20 — default bottom rest

class FloatingMealTrigger extends ConsumerStatefulWidget {
  const FloatingMealTrigger({super.key});

  @override
  ConsumerState<FloatingMealTrigger> createState() =>
      _FloatingMealTriggerState();
}

class _FloatingMealTriggerState extends ConsumerState<FloatingMealTrigger> {
  bool _expanded = false;
  bool _fabPressed = false;
  bool _dragging = false;

  /// Live FAB position while the session value is being moved; falls back to the
  /// provider, then the default, resolved against the current bounds each build.
  Offset? _pos;

  final TextEditingController _controller = TextEditingController();
  final FocusNode _focus = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _open() {
    HapticFeedback.lightImpact();
    setState(() => _expanded = true);
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  void _close() {
    HapticFeedback.selectionClick();
    _focus.unfocus();
    setState(() => _expanded = false);
  }

  void _submit() {
    final meal = _controller.text.trim();
    if (meal.isEmpty) return;
    HapticFeedback.mediumImpact(); // commit cue
    _controller.clear();
    _focus.unfocus();
    setState(() => _expanded = false);
    context.go('/logging?meal=${Uri.encodeComponent(meal)}');
  }

  // ── Position helpers ───────────────────────────────────────────────────────

  Offset _defaultPos(double w, double h) =>
      Offset(w - _fabSize - _fabMargin, h - _fabSize - _fabBottomGap);

  Offset _clampPos(Offset p, double w, double h) {
    final maxX = (w - _fabSize - _fabMargin).clamp(_fabMargin, double.infinity);
    final maxY =
        (h - _fabSize - _fabBottomGap).clamp(_fabMargin, double.infinity);
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

        // Anchor the input bar above the FAB when there's room overhead, else
        // below it — so it stays visually attached wherever the FAB lives.
        final showAbove = pos.dy > h * 0.4;
        final barTop = showAbove ? null : pos.dy + _fabSize + 8;
        final barBottom = showAbove ? (h - pos.dy + 8) : null;

        return SizedBox.expand(
          child: Stack(
            children: [
              // Expanding meal-input bar, re-anchored to the FAB.
              Positioned(
                left: _fabMargin,
                right: _fabMargin,
                top: barTop,
                bottom: barBottom,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 160),
                  transitionBuilder: (child, anim) => FadeTransition(
                    opacity: anim,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, 8 / 44),
                        end: Offset.zero,
                      ).animate(anim),
                      child: child,
                    ),
                  ),
                  child: _expanded
                      ? _MealInputBar(
                          key: const ValueKey('meal-input'),
                          controller: _controller,
                          focusNode: _focus,
                          onSubmit: _submit,
                        )
                      : const SizedBox.shrink(key: ValueKey('hidden')),
                ),
              ),

              // The draggable FAB.
              Positioned(
                left: pos.dx,
                top: pos.dy,
                width: _fabSize,
                height: _fabSize,
                child: Semantics(
                  button: true,
                  label: _expanded
                      ? tr('dashboard.mealTrigger.close')
                      : tr('dashboard.logMeal'),
                  child: GestureDetector(
                    onTapDown: (_) => setState(() => _fabPressed = true),
                    onTapUp: (_) => setState(() => _fabPressed = false),
                    onTapCancel: () => setState(() => _fabPressed = false),
                    onTap: _expanded ? _close : _open,
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
                              _fabPressed ? NhamColors.btnHover : NhamColors.btn,
                          borderRadius:
                              BorderRadius.circular(NhamRadii.containerLg), // 16
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
                        child: Icon(
                          _expanded
                              ? LucideIcons.x
                              : LucideIcons.utensilsCrossed,
                          size: 20, // h-5 w-5
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

/// Compact meal-input row (web `compact` → h-11): rounded-2xl, hairline border,
/// card bg, focus-within accent border, with an ArrowUp submit button.
class _MealInputBar extends StatefulWidget {
  const _MealInputBar({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onSubmit;

  @override
  State<_MealInputBar> createState() => _MealInputBarState();
}

class _MealInputBarState extends State<_MealInputBar> {
  bool _sendPressed = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onText);
    widget.focusNode.addListener(_onFocus);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onText);
    widget.focusNode.removeListener(_onFocus);
    super.dispose();
  }

  void _onText() => setState(() {});
  void _onFocus() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final hasText = widget.controller.text.trim().isNotEmpty;
    final focused = widget.focusNode.hasFocus;

    return Container(
      height: 44, // compact h-11
      padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3), // px-3
      decoration: BoxDecoration(
        color: NhamColors.elev, // bg-card
        borderRadius: BorderRadius.circular(
          NhamRadii.containerLg,
        ), // rounded-2xl
        border: Border.all(
          // border-nham-border/70 → focus-within:border-nham-accent/50.
          color: focused ? NhamColors.accent50 : const Color(0xB3E8E6DC),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: widget.focusNode,
              maxLength: 300,
              cursorColor: NhamColors.accent,
              onSubmitted: (_) => widget.onSubmit(),
              style: NhamTextStyles.sansRegular(
                fontSize: NhamFontSize.sm,
              ).copyWith(color: NhamColors.text),
              decoration: InputDecoration(
                counterText: '',
                isCollapsed: true,
                border: InputBorder.none,
                hintText: tr('logging.placeholder'),
                hintStyle: NhamTextStyles.sansRegular(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.stone),
              ),
            ),
          ),
          const SizedBox(width: NhamSpacing.sp2), // gap-2
          // Submit: h-8 w-8 rounded-xl btn → hover btn-hover; disabled track.
          GestureDetector(
            onTapDown:
                hasText ? (_) => setState(() => _sendPressed = true) : null,
            onTapUp:
                hasText ? (_) => setState(() => _sendPressed = false) : null,
            onTapCancel: () => setState(() => _sendPressed = false),
            onTap: hasText ? widget.onSubmit : null,
            child: Container(
              width: 32, // h-8 w-8
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color:
                    !hasText
                        ? NhamColors.track
                        : (_sendPressed ? NhamColors.btnHover : NhamColors.btn),
                borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // 12
              ),
              child: Icon(
                LucideIcons.arrowUp,
                size: 16, // h-4 w-4
                color: hasText ? Colors.white : NhamColors.stone,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
