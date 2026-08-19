import 'package:flutter/widgets.dart';

import '../../../theme/calm_tokens.dart';

/// A page header whose bottom hairline only exists once the page has scrolled.
///
/// At rest the header sits flush on the page — no rule, nothing to read as
/// clutter (the Threads / iOS large-title move: the line is a scroll cue, not
/// chrome). The moment content slides up underneath it, a [kHairline] fades in
/// to say "there is more above"; scroll back to the top and it fades away.
///
/// It wraps the header **and** its scroll view, so any scrollable works —
/// [ListView], [CustomScrollView], [SingleChildScrollView] — because it listens
/// to the [ScrollNotification] the viewport bubbles up rather than owning a
/// [ScrollController]. A body that swaps between a skeleton, an error view and
/// the real list therefore needs no re-plumbing.
///
/// Cheap by construction: the callback only calls `setState` when the boolean
/// crosses, never on a scroll frame, and the hairline always occupies its 1px
/// of layout so fading it in can't shift the content.
///
/// The [header] keeps whatever it paints — a translucent fill, a
/// `BackdropFilter` blur — untouched: the hairline is a sibling laid out
/// *below* it, never a decoration on it.
class ScrollSeparator extends StatefulWidget {
  const ScrollSeparator({
    super.key,
    required this.header,
    required this.child,
    this.overlay,
    this.threshold = 1,
  });

  /// The pinned header the hairline sits under.
  final Widget header;

  /// The page body — a scroll view (directly, or behind loading/error states).
  final Widget child;

  /// Chrome floating over the body: a dock, a FAB. It is laid out in a [Stack]
  /// with [child] but deliberately OUTSIDE the notification listener.
  ///
  /// This is not a convenience. `depth != 0` only screens out scrollables
  /// *nested inside* the body — an overlay is a sibling, so its scrolls arrive
  /// at depth 0 like the body's own. A multiline `TextField` builds a real
  /// vertical `Scrollable`, so a composer docked over a feed would drive this
  /// hairline as the user typed past its max height, with the feed still at
  /// the top. Passing chrome here instead of stacking it around
  /// [ScrollSeparator] makes "what counts as the page body" structural rather
  /// than a runtime guess.
  final Widget? overlay;

  /// Scroll offset past which the hairline shows. Small on purpose: the line
  /// should arrive as soon as anything has slid under the header.
  final double threshold;

  @override
  State<ScrollSeparator> createState() => _ScrollSeparatorState();
}

class _ScrollSeparatorState extends State<ScrollSeparator> {
  bool _scrolled = false;

  bool _onScroll(ScrollNotification notification) {
    // Only the page's own vertical viewport: `depth > 0` is a nested scrollable
    // (a horizontal option strip, a sheet) whose offset says nothing about
    // whether THIS page has scrolled.
    if (notification.depth != 0) return false;
    if (notification.metrics.axis != Axis.vertical) return false;
    final scrolled = notification.metrics.pixels > widget.threshold;
    if (scrolled != _scrolled) setState(() => _scrolled = scrolled);
    return false; // never swallow it — other listeners still want it
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        widget.header,
        AnimatedOpacity(
          opacity: _scrolled ? 1 : 0,
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOut,
          child: const SizedBox(
            height: 1,
            child: ColoredBox(color: kHairline),
          ),
        ),
        Expanded(
          child: Stack(
            children: [
              Positioned.fill(
                child: NotificationListener<ScrollNotification>(
                  onNotification: _onScroll,
                  child: widget.child,
                ),
              ),
              if (widget.overlay != null) widget.overlay!,
            ],
          ),
        ),
      ],
    );
  }
}
