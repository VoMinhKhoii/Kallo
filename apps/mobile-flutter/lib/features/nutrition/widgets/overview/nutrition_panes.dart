import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../../shared/widgets/panes/page_window.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';

/// Moves the keyed scroll views when the fold changes the section arrangement.
/// Both offsets belong to this owner, rather than to either layout branch.
class NutritionPanes extends StatefulWidget {
  const NutritionPanes({
    super.key,
    required this.onRefresh,
    required this.onClearSelection,
    required this.page,
  });
  final Future<void> Function() onRefresh;
  final VoidCallback onClearSelection;
  final List<Widget> Function(double bottom, bool? near) page;

  @override
  State<NutritionPanes> createState() => _NutritionPanesState();
}

class _NutritionPanesState extends State<NutritionPanes> {
  final _far = ScrollController();
  final _near = ScrollController();
  final _farKey = GlobalKey();
  final _nearKey = GlobalKey();

  @override
  void dispose() {
    _far.dispose();
    _near.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final layout = PageWindow.of(context);
    Widget scroll(bool near) => GestureDetector(
      key: PageStorageKey(near ? 'nutrition-near' : 'nutrition-far'),
      behavior: HitTestBehavior.translucent,
      onTap: widget.onClearSelection,
      child: KalloRefreshableScroll(
        key: near ? _nearKey : _farKey,
        controller: near ? _near : _far,
        onRefresh: widget.onRefresh,
        slivers: (bottom) => widget.page(bottom, layout.twoPane ? near : null),
      ),
    );
    if (!layout.twoPane) return scroll(false);
    return TwoPaneScaffold(
      header: const SizedBox.shrink(),
      far: scroll(false),
      near: scroll(true),
    );
  }
}
