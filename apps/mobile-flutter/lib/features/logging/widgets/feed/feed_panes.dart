import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/panes/pane_insets.dart';
import '../../../../shared/widgets/panes/pane_slot.dart';
import '../../../../shared/widgets/surface/scroll_separator.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';
import '../../../../shell/window/window_layout.dart';

/// What a two-pane Log puts around the feed.
class FeedPaneParts {
  const FeedPaneParts({required this.title, required this.far, this.nudge});

  /// The day's title over the gauges.
  final Widget title;

  /// A note for the day, at the top of the feed: it scrolls away with the
  /// cards rather than standing over them.
  final Widget? nudge;

  /// The far pane. It owns its scroll view and keeps it under a key of its
  /// own, so a fold moves it rather than rebuilding it.
  final Widget far;
}

/// Keeps the feed owner above the fold switch, and the summary scrollable in
/// short windows. The keyed near child moves with its composer and scroll view.
///
/// In two panes the near pane is the Log page as one column shows it, less
/// the week strip: the day's title over one row of the four gauges, then the
/// feed and the composer. The far pane is the screen's [far], the days.
class FeedPanes extends StatefulWidget {
  const FeedPanes({
    super.key,
    required this.feed,
    required this.overlay,
    required this.compactSummary,
    required this.paneSummary,
    this.parts,
  });
  final Widget Function(Widget? header) feed;
  final Widget overlay;
  final Widget compactSummary;

  /// The gauge row for the near pane: no side inset of its own, the pane's.
  final Widget paneSummary;

  /// Two panes only; null in one column.
  final FeedPaneParts? parts;

  @override
  State<FeedPanes> createState() => _FeedPanesState();
}

class _FeedPanesState extends State<FeedPanes> {
  final _nearKey = GlobalKey(debugLabel: 'logging-feed');
  final _farKey = GlobalKey(debugLabel: 'logging-days');

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    final inset = paneInsets(context, slot: PaneSlot.near);
    // Beside the days, the title and the gauges stay put over the feed while
    // the window leaves the feed room under them: not under a pinned video,
    // and not while the keyboard takes the lower half. Then they scroll with
    // the cards, as the summary does in a short single column.
    final roomy =
        layout.size.height - MediaQuery.viewInsetsOf(context).bottom >=
        kRegularHeight;
    final pinned = layout.twoPane && roomy;
    final paneHeader =
        layout.twoPane
            ? Padding(
              padding: inset,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.parts != null) widget.parts!.title,
                  widget.paneSummary,
                ],
              ),
            )
            : null;
    final nudge =
        layout.twoPane && widget.parts?.nudge != null
            ? Padding(padding: inset, child: widget.parts!.nudge)
            : null;
    final Widget? scrolled =
        !layout.twoPane
            ? (layout.compactHeight ? widget.compactSummary : null)
            : pinned
            ? nudge
            : Column(children: [paneHeader!, if (nudge != null) nudge]);
    // The hairline sits under the pinned summary in tall single columns,
    // and under the date strip when the summary scrolls in a short window.
    // A rule above a pinned summary would claim content had passed beneath
    // that summary when it had not; each arrangement anchors to its scroll.
    final near = ScrollSeparator(
      key: _nearKey,
      header:
          pinned
              ? paneHeader!
              : layout.twoPane || layout.compactHeight
              ? const SizedBox.shrink()
              : widget.compactSummary,
      // Filled, not bottom-anchored: the dock must be BOUNDED by this Stack or
      // the `/` picker grows past its top and is clipped. See FeedComposer.
      overlay: Positioned.fill(child: widget.overlay),
      // The card list. The composer floats over its bottom edge as an
      // `overlay`, NOT as a child — it owns a multiline field whose own
      // vertical Scrollable would otherwise reach the hairline listener as a
      // depth-0 sibling and raise the rule while the feed sat at the top.
      child: widget.feed(scrolled),
    );
    return TwoPaneScaffold(
      single: near,
      // Under a key, so the month on show survives the panes changing sides.
      far:
          widget.parts == null
              ? const SizedBox.shrink()
              : KeyedSubtree(key: _farKey, child: widget.parts!.far),
      near: near,
    );
  }
}
