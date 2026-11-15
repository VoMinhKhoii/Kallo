import '../../../../shared/widgets/panes/pane_slot.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/panes/pane_scroll.dart';
import '../../../../shell/window/window_layout.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';

/// Moves the keyed scroll views when the fold changes the section arrangement.
/// Both panes' keys, and so their offsets, belong to this owner rather than
/// to either layout branch.
class NutritionPanes extends StatefulWidget {
  const NutritionPanes({
    super.key,
    required this.onRefresh,
    required this.onClearSelection,
    required this.page,
  });
  final Future<void> Function() onRefresh;
  final VoidCallback onClearSelection;
  final List<Widget> Function(double bottom, PaneSlot slot) page;

  @override
  State<NutritionPanes> createState() => _NutritionPanesState();
}

class _NutritionPanesState extends State<NutritionPanes> {
  final _farKey = GlobalKey();
  final _nearKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    Widget scroll(bool near) => GestureDetector(
      key: PageStorageKey(near ? 'nutrition-near' : 'nutrition-far'),
      behavior: HitTestBehavior.translucent,
      onTap: widget.onClearSelection,
      child: PaneScroll(
        key: near ? _nearKey : _farKey,
        onRefresh: widget.onRefresh,
        slivers:
            (bottom) => widget.page(
              bottom,
              layout.twoPane
                  ? (near ? PaneSlot.near : PaneSlot.far)
                  : PaneSlot.single,
            ),
      ),
    );
    return TwoPaneScaffold(
      single: scroll(false),
      far: scroll(false),
      near: scroll(true),
    );
  }
}
