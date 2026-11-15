import '../../../../shared/widgets/panes/pane_insets.dart';
import '../../../../shared/widgets/panes/pane_slot.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';
import '../../../../shell/window/window_layout.dart';

/// Keeps the feed owner above the fold switch, and the summary scrollable in
/// short windows. The keyed near child moves with its composer and scroll view.
class FeedPanes extends StatefulWidget {
  const FeedPanes({
    super.key,
    required this.near,
    required this.summary,
    required this.onRefresh,
    this.farHeader,
  });
  final Widget near;
  final Widget summary;
  final Widget? farHeader;
  final Future<void> Function() onRefresh;

  @override
  State<FeedPanes> createState() => _FeedPanesState();
}

class _FeedPanesState extends State<FeedPanes> {
  final _farKey = GlobalKey();
  final _farScroll = ScrollController();

  @override
  void dispose() {
    _farScroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    if (!layout.twoPane) return widget.near;
    return TwoPaneScaffold(
      header: const SizedBox.shrink(),
      far: KalloRefreshableScroll(
        key: _farKey,
        controller: _farScroll,
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
      near: widget.near,
    );
  }
}
