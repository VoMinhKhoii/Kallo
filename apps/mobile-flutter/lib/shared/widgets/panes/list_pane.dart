import 'package:flutter/widgets.dart';

import 'two_pane_scaffold.dart';

/// Reparents the list's scroll view rather than attaching a second position.
class ListPane extends StatefulWidget {
  const ListPane({super.key, required this.child, required this.emptyDetail});
  final Widget child;
  final Widget emptyDetail;

  @override
  State<ListPane> createState() => _ListPaneState();
}

class _ListPaneState extends State<ListPane> {
  final _list = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final child = KeyedSubtree(key: _list, child: widget.child);
    return TwoPaneScaffold(single: child, far: child, near: widget.emptyDetail);
  }
}
