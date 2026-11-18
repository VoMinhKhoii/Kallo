import 'package:flutter/widgets.dart';

import '../feedback/kallo_refresh.dart';

/// One pane's refreshable scroll view, and the controller it scrolls with.
///
/// A fold or a rotation MOVES each pane's scroll view to its new place in the
/// tree rather than mounting a second one on the same controller: that keeps
/// the offset, and it keeps the controller on one position at a time (two
/// positions on one controller crashed the first two-pane screen). The move
/// needs a key that outlives this widget's own place in the tree, so the key
/// is a required [GlobalKey] the screen holds above its layout switch, and
/// the controller lives in this widget's State, which the key carries along.
class PaneScroll extends StatefulWidget {
  const PaneScroll({
    required GlobalKey super.key,
    required this.onRefresh,
    required this.slivers,
  });

  final Future<void> Function() onRefresh;

  /// The pane's slivers, given the bottom inset (see [KalloRefreshableScroll]).
  final List<Widget> Function(double bottomInset) slivers;

  @override
  State<PaneScroll> createState() => _PaneScrollState();
}

class _PaneScrollState extends State<PaneScroll> {
  final _controller = ScrollController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => KalloRefreshableScroll(
    controller: _controller,
    onRefresh: widget.onRefresh,
    slivers: widget.slivers,
  );
}
