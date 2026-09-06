import 'package:flutter/material.dart';

import '../../../theme/kallo_motion.dart';

/// A sheet's own one-deep navigation: the surface stays put and its CONTENT
/// slides, so a second level never stacks a second modal on the first.
///
/// Used where a sheet has a setting worth its own page (the mode sheet's cheat
/// intensity). A nested [Navigator] is the obvious reach and the wrong one: it
/// captures the `pop(result)` the host sheet answers its caller with, and a
/// second `showNhamSheet` puts a surface, a grabber and a scrim on top of the
/// surface, grabber and scrim already there — two sheets to dismiss for one
/// choice. The reference this follows is plainly one sheet whose content
/// pushes.
///
/// **It pages, it does not crossfade** (2026-09-03). This was an
/// [AnimatedSwitcher] cross-fade over a ±0.12-width slide: two pages visible
/// through each other while the sheet shrank underneath them, which reads as a
/// flicker rather than as travel. The pages now translate a FULL width with no
/// opacity change at all — the same thing your thumb does to the week strip.
///
/// **Why [KalloMotion.page] (280) and not [KalloMotion.emphasis].** This is the
/// same gesture language as the strip paging — a page of content moving
/// sideways under a swipe — so it borrows that token rather than the
/// change-shape one. It is deliberately NOT the iOS route-push timing (~350):
/// nothing is being pushed onto the navigator here, and borrowing the route
/// duration would advertise a screen transition the app then refuses to give
/// back with an interactive edge swipe.
///
/// **The height is held, not chased.** The two pages rarely agree on a height.
/// The loose [Stack] takes the taller of the two, so for the whole slide the
/// sheet stands at the max of outgoing and incoming and neither page is ever
/// clipped mid-travel; [AnimatedSize] only settles to the survivor's height
/// once the outgoing page is gone.
///
/// Its key is what makes that true in the growing direction. Left alone,
/// [AnimatedSize] would ANIMATE up to the taller page too, and the page
/// arriving from the right would spend the slide inside a box still too short
/// for it — the "shrink to exactly fit mid-transition" bug wearing its other
/// face. Re-keying it on each swap gives the swap a fresh `RenderAnimatedSize`,
/// which adopts its child's size on first layout instead of animating to it, so
/// the height jumps straight to the max and the only motion the token pays for
/// is the settle afterwards. (`Duration.zero` is the obvious alternative and
/// asserts: the zero-length controller completes inside `performLayout` and
/// re-dirties the render object mid-layout.) The cost of that fresh key is
/// that BOTH pages' [State] is rebuilt from scratch on every swap, so a future
/// page that holds a scroll offset or a [TextEditingController] must lift that
/// state above the swap rather than expect it to survive one.
///
/// No [ColoredBox] under the pages: they never overlap horizontally (one is
/// entering exactly as far as the other is leaving) and the sheet surface
/// beneath them is opaque, so there is nothing to mask.
class SheetPageSwap extends StatefulWidget {
  const SheetPageSwap({
    super.key,
    required this.child,
    required this.isSecondLevel,
    this.duration = KalloMotion.page,
  });

  /// The page to show. Its `key` must differ between levels, or the swap reads
  /// as a rebuild of one page and the outgoing copy has nothing to identify it.
  final Widget child;

  /// Which way the pages travel — forward for a push, back for a pop.
  final bool isSecondLevel;

  final Duration duration;

  @override
  State<SheetPageSwap> createState() => _SheetPageSwapState();
}

class _SheetPageSwapState extends State<SheetPageSwap>
    with SingleTickerProviderStateMixin {
  // Rests at 1 — the incoming tween's END is the settled position, so a page
  // that never swapped must sit at the far end of the controller, not at 0.
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
    value: 1,
  )..addStatusListener(_onStatus);

  late final CurvedAnimation _curved = CurvedAnimation(
    parent: _controller,
    curve: KalloEase.decelerate,
  );

  /// The page being left behind, kept mounted only for the length of the slide.
  Widget? _outgoing;

  /// Bumped once per swap, purely to re-key the [AnimatedSize] — see the class
  /// doc. Nothing that would otherwise survive the swap is under it: both slots
  /// are rebuilt at the flip anyway.
  int _swaps = 0;

  void _onStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed && _outgoing != null) {
      setState(() => _outgoing = null);
    }
  }

  @override
  void didUpdateWidget(SheetPageSwap oldWidget) {
    super.didUpdateWidget(oldWidget);
    _controller.duration = widget.duration;
    if (oldWidget.isSecondLevel != widget.isSecondLevel) {
      _outgoing = oldWidget.child;
      _swaps++;
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _curved.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sliding = _outgoing != null;
    // Push sends the incoming page in from the right and the outgoing one off
    // to the left; pop mirrors both.
    final double sign = widget.isSecondLevel ? 1 : -1;

    return ClipRect(
      child: AnimatedSize(
        key: ValueKey(_swaps),
        duration: widget.duration,
        curve: KalloEase.decelerate,
        alignment: Alignment.topCenter,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            // Conditional children in a Stack need keys, or Flutter matches the
            // surviving page against the departing one's slot and destroys the
            // subtree mid-animation (mobile.md, the date-morph bug).
            if (sliding)
              SlideTransition(
                key: const ValueKey('sheet-page-swap-outgoing'),
                position: Tween<Offset>(
                  begin: Offset.zero,
                  end: Offset(-sign, 0),
                ).animate(_curved),
                child: _outgoing,
              ),
            SlideTransition(
              key: const ValueKey('sheet-page-swap-incoming'),
              position: Tween<Offset>(
                begin: Offset(sign, 0),
                end: Offset.zero,
              ).animate(_curved),
              child: widget.child,
            ),
          ],
        ),
      ),
    );
  }
}
