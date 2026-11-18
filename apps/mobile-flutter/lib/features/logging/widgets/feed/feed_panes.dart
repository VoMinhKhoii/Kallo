import '../../../../shared/widgets/panes/pane_insets.dart';
import '../../../../shared/widgets/panes/pane_slot.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/panes/pane_scroll.dart';
import '../../../../shared/widgets/surface/scroll_separator.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';
import '../../../../shell/window/window_layout.dart';

/// Keeps the feed owner above the fold switch, and the summary scrollable in
/// short windows. The keyed near child moves with its composer and scroll view.
class FeedPanes extends StatefulWidget {
  const FeedPanes({
    super.key,
    required this.feed,
    required this.overlay,
    required this.summary,
    required this.compactSummary,
    required this.onRefresh,
    this.farHeader,
  });
  final Widget Function(Widget? header) feed;
  final Widget overlay;
  final Widget compactSummary;
  final Widget summary;
  final Widget? farHeader;
  final Future<void> Function() onRefresh;

  @override
  State<FeedPanes> createState() => _FeedPanesState();
}

class _FeedPanesState extends State<FeedPanes> {
  final _nearKey = GlobalKey(debugLabel: 'logging-feed');
  final _farKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    // The hairline sits under the pinned summary in tall single columns,
    // and under the date strip when the summary scrolls in a short window.
    // A rule above a pinned summary would claim content had passed beneath
    // that summary when it had not; each arrangement anchors to its scroll.
    final near = ScrollSeparator(
      key: _nearKey,
      header:
          layout.twoPane || layout.compactHeight
              ? const SizedBox.shrink()
              : widget.compactSummary,
      // Filled, not bottom-anchored: the dock must be BOUNDED by this Stack or
      // the `/` picker grows past its top and is clipped. See FeedComposer.
      overlay: Positioned.fill(child: widget.overlay),
      // The card list. The composer floats over its bottom edge as an
      // `overlay`, NOT as a child — it owns a multiline field whose own
      // vertical Scrollable would otherwise reach the hairline listener as a
      // depth-0 sibling and raise the rule while the feed sat at the top.
      child: widget.feed(
        !layout.twoPane && layout.compactHeight ? widget.compactSummary : null,
      ),
    );
    return TwoPaneScaffold(
      single: near,
      far: PaneScroll(
        key: _farKey,
        onRefresh: widget.onRefresh,
        slivers:
            (bottom) => [
              SliverPadding(
                padding: paneInsets(
                  context,
                  slot: PaneSlot.far,
                  bottom: bottom + 12,
                ),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    children: [
                      if (widget.farHeader != null) widget.farHeader!,
                      widget.summary,
                    ],
                  ),
                ),
              ),
            ],
      ),
      near: near,
    );
  }
}
