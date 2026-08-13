import 'package:flutter/widgets.dart';

/// Flips its child in place whenever [frameKey] changes: the outgoing line
/// leaves upward, and only once it is gone does the incoming line rise into
/// its place.
///
/// This is `motion`'s `<AnimatePresence mode="wait">` from the web meal bar,
/// which Flutter has no direct equivalent for. `AnimatedSwitcher` deliberately
/// CROSS-FADES — it runs the outgoing and incoming transitions concurrently and
/// stacks both children — so during a burst of `item_macros` frames it renders
/// two (or three) ticker texts on top of each other. `mode="wait"` queues
/// instead, which is what this does: exactly one line is ever in the tree.
class TickerFlip extends StatefulWidget {
  const TickerFlip({
    super.key,
    required this.frameKey,
    required this.child,
    this.prefix,
  });

  /// A word that stays PUT while [child] flips beneath it.
  ///
  /// Vietnamese builds every action verb as `Đang <verb>`, so flipping the
  /// whole phrase re-animated the same word every time. The prefix is adopted
  /// at the same midpoint as [child] — never animated, but never out of step
  /// with what is painted either, so it cannot linger over a dish that has no
  /// prefix at all.
  final Widget? prefix;

  /// Identity of the current frame. A change starts a flip; an equal value must
  /// leave the line completely alone.
  final String frameKey;

  /// The line for the CURRENT frame. Held back until the midpoint of a flip —
  /// the outgoing half keeps painting the previous child, which is the whole
  /// point of "wait".
  final Widget child;

  @override
  State<TickerFlip> createState() => _TickerFlipState();
}

class _TickerFlipState extends State<TickerFlip>
    with SingleTickerProviderStateMixin {
  /// 180ms out, then 180ms in — the web's `duration: 0.18` per half.
  static const Duration _half = Duration(milliseconds: 180);
  static const Curve _expoOut = Cubic(0.16, 1, 0.3, 1); // motion [0.16,1,0.3,1]
  static const double _travel = 10; // the web's y: ±10

  /// Built in [initState], not as a `late final` initializer: under reduced
  /// motion nothing ever drives it, so the first access would be `dispose()`
  /// — which would mint a Ticker against an already-deactivated element.
  late final AnimationController _controller;

  /// What is actually PAINTED. Lags the widget for the first half of a flip.
  ///
  /// Seeded in [initState], NOT with a `late` field initializer: a `late` field
  /// initializes on first ACCESS, so the first read inside `didUpdateWidget`
  /// would capture the already-updated `widget` and the flip would be skipped
  /// entirely — the new line would simply appear.
  late String _shownKey;
  late Widget _shownChild;
  Widget? _shownPrefix;

  /// Whether this flip has passed its midpoint and swapped content.
  bool _swapped = false;

  @override
  void initState() {
    super.initState();
    _adopt();
    _controller = AnimationController(vsync: this, duration: _half * 2)
      ..addListener(_onTick)
      ..addStatusListener(_onStatus);
  }

  void _adopt() {
    _shownKey = widget.frameKey;
    _shownChild = widget.child;
    _shownPrefix = widget.prefix;
  }

  void _onTick() {
    if (_swapped || _controller.value < 0.5) return;
    // Adopt the LATEST frame, not the one that started this flip: anything that
    // arrived mid-transition collapses into this swap rather than queueing a
    // flip each, which is what keeps a fast burst readable.
    _swapped = true;
    setState(_adopt);
  }

  void _onStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    // Something landed after the midpoint — flip again (the "wait" queue).
    if (widget.frameKey != _shownKey) _start();
  }

  void _start() {
    _swapped = false;
    _controller.forward(from: 0);
  }

  @override
  void didUpdateWidget(covariant TickerFlip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.frameKey == _shownKey) {
      // Same frame, rebuilt content (a locale change, a restyle): take it
      // silently. Animating here would flip the line for no reason.
      if (!_controller.isAnimating) {
        _shownChild = widget.child;
        _shownPrefix = widget.prefix;
      }
      return;
    }
    if (MediaQuery.disableAnimationsOf(context)) {
      setState(_adopt);
      return;
    }
    if (!_controller.isAnimating) _start();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return _withPrefix(widget.prefix, widget.child);
    }
    return _withPrefix(_shownPrefix, _animated());
  }

  /// The static half sits OUTSIDE the transition, so it holds still.
  Widget _withPrefix(Widget? prefix, Widget child) {
    if (prefix == null) return child;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [prefix, Flexible(child: child)],
    );
  }

  Widget _animated() {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final value = _controller.value;
        final leaving = value < 0.5;
        final t = _expoOut.transform(
          (leaving ? value / 0.5 : (value - 0.5) / 0.5).clamp(0.0, 1.0),
        );
        // Out: opacity 1→0, rising to −10. In: opacity 0→1, rising from +10.
        return Opacity(
          opacity: (leaving ? 1 - t : t).clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(0, leaving ? -_travel * t : _travel * (1 - t)),
            child: child,
          ),
        );
      },
      child: _shownChild,
    );
  }
}
