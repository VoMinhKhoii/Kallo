import 'package:flutter/material.dart';

import '../../window/window_layout.dart';
import 'nav_column_shadow.dart';
import 'outside_column.dart';

/// True from the moment a Log page is pushed over the tab shell until it
/// starts to leave.
///
/// The shell reads it twice: the side capsule marks Log as the current item,
/// and the branch under the page drops out of the semantics tree, since a
/// page beside the column no longer blocks what is beneath it.
final logOverShell = ValueNotifier<bool>(false);

/// The Log screen's page: pushed over the tab shell like any page, but in a
/// window with a control column it leaves the column to the shell, so the
/// shell's own capsule stays where it stands on the tabbed screens.
///
/// One capsule, the shell's, in every window: Log draws none. Where the
/// window has no control column the route is the plain opaque page it always
/// was, and renders as before.
class LogPage extends Page<void> {
  const LogPage({required this.child, super.key});
  final Widget child;

  @override
  Route<void> createRoute(BuildContext context) => _LogRoute(this);
}

class _LogRoute extends PageRoute<void>
    with MaterialRouteTransitionMixin<void> {
  _LogRoute(LogPage page) : super(settings: page);

  /// Whether the window has a control column. Read off the navigator when the
  /// route is installed, then kept in step by [_ColumnSync] as the window
  /// changes (a fold, a rotation).
  bool _besideColumn = false;

  @override
  Widget buildContent(BuildContext context) => (settings as LogPage).child;

  @override
  bool get maintainState => true;

  /// Beside the column the shell has to keep painting under this page, or
  /// the column would be empty.
  @override
  bool get opaque => !_besideColumn;

  /// Beside the column the shell stays put while Log slides in, as a tab
  /// switch leaves the capsule standing.
  @override
  bool canTransitionFrom(TransitionRoute<dynamic> previousRoute) =>
      !_besideColumn;

  /// Beside the column, taps on the column reach the shell's capsule. The
  /// page itself still takes every tap on it: `Screen` is an opaque target.
  @override
  Widget buildModalBarrier() =>
      _besideColumn ? const IgnorePointer() : super.buildModalBarrier();

  /// Log pages standing over the shell. A set, not a flag: a page still
  /// leaving must not clear the mark for the next one already pushed.
  static final _standing = <_LogRoute>{};

  void _stand(bool standing) {
    standing ? _standing.add(this) : _standing.remove(this);
    logOverShell.value = _standing.isNotEmpty;
  }

  @override
  void install() {
    _besideColumn = WindowLayout.of(navigator!.context).hasControlColumn;
    super.install();
    _stand(true);
  }

  @override
  bool didPop(void result) {
    _stand(false);
    return super.didPop(result);
  }

  @override
  void dispose() {
    _stand(false);
    super.dispose();
  }

  /// The route under this one, the tab shell.
  Route<dynamic>? _below;

  @override
  void didChangePrevious(Route<dynamic>? previousRoute) {
    super.didChangePrevious(previousRoute);
    _below = previousRoute;
  }

  void _sync(bool besideColumn) {
    if (besideColumn == _besideColumn || !isActive) return;
    _besideColumn = besideColumn;
    if (animation!.isCompleted) overlayEntries.first.opaque = opaque;
    // The shell decided whether to slide away under this page when the page
    // was pushed, by asking [canTransitionFrom]. Without a column it slid a
    // third of the window aside and is parked there; with one it must stand
    // still. A window that gains or loses its column while Log is open (a
    // rotation, a fold) makes it ask again, as the navigator does when the
    // route over it changes.
    // ignore: invalid_use_of_protected_member
    if (_below?.isActive ?? false) _below!.didChangeNext(this);
    changedInternalState();
  }

  @override
  Widget buildPage(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
  ) {
    final column = WindowLayout.of(context).hasControlColumn;
    return _ColumnSync(
      besideColumn: column,
      onChanged: _sync,
      child: NavColumnShadow(
        show: column,
        child: super.buildPage(context, animation, secondaryAnimation),
      ),
    );
  }

  /// Outside the transition, so the page slides in from behind the column
  /// rather than over it, and a tap on the column never lands on the page.
  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final layout = WindowLayout.of(context);
    return ClipRect(
      clipper: OutsideColumn(layout),
      clipBehavior: layout.hasControlColumn ? Clip.hardEdge : Clip.none,
      child: super.buildTransitions(
        context,
        animation,
        secondaryAnimation,
        child,
      ),
    );
  }
}

/// Tells the route when the window gains or loses its column, after the
/// frame: the route's overlay entries cannot change during a build.
class _ColumnSync extends StatefulWidget {
  const _ColumnSync({
    required this.besideColumn,
    required this.onChanged,
    required this.child,
  });

  final bool besideColumn;
  final ValueChanged<bool> onChanged;
  final Widget child;

  @override
  State<_ColumnSync> createState() => _ColumnSyncState();
}

class _ColumnSyncState extends State<_ColumnSync> {
  @override
  void didUpdateWidget(_ColumnSync oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.besideColumn == widget.besideColumn) return;
    final value = widget.besideColumn;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onChanged(value);
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
