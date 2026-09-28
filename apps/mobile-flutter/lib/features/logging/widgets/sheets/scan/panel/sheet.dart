import 'package:flutter/material.dart';

import '../../../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_shapes.dart';
import 'drag.dart';
import 'page_stack.dart';
import 'panel.dart';
import 'scope.dart';

/// The one sheet that rises INSIDE the scan screen, over the frozen camera,
/// and stays up while its pages change under it ([ScanPageStack]): the result,
/// its other nutrients, the editor, a miss. Going a level in or out is the
/// content travelling sideways — the sheet never drops and comes back.
///
/// **Why not a sheet route** (the `Cupertino wins` rule's exception, with its
/// defect): `CupertinoSheetRoute` has one height — no detents — and a second
/// route would scale the camera route back and away, taking the scanned
/// product out of view, which is the whole point of the frozen frame above.
/// Retire this if the SDK's sheet gains detents that leave the route behind it
/// in place.
///
/// Being no route, it carries a sheet's gestures itself, doing what the page
/// showing registered ([ScanSheetScope]):
///
/// - **Drag down to dismiss**, from the header or the dock, or from the body
///   once its scroll is at the top (the pull carries on as the sheet's).
/// - **Tap outside to dismiss**, over the frozen frame above. With the
///   keyboard up that first tap only puts the keyboard away.
/// - **Tap the sheet to put the keyboard away**: the number pad has no return
///   key of its own.
/// - **Swipe right to go back** on a deeper page; the pop carries on from
///   where the finger let go.
///
/// Buttons, fields and scrollables inside win their own taps and drags: they
/// sit deeper in the hit test, so they enter the gesture arena first.
///
/// Painted in the canvas colour so the result's white cards separate by
/// surface, as on a page; corners at [kSheetRadius], concentric with the
/// header's controls.
class ScanSheet extends StatefulWidget {
  const ScanSheet({super.key, required this.page});

  final ScanSheetPage page;

  @override
  State<ScanSheet> createState() => _ScanSheetState();
}

class _ScanSheetState extends State<ScanSheet>
    with SingleTickerProviderStateMixin {
  // Built in initState, not lazily: a sheet never dragged would otherwise
  // build its ticker for the first time in `dispose`, off a dead element.
  late final ScanPanelDrag _drag;
  final ScanSheetCallbacks _callbacks = ScanSheetCallbacks();
  final GlobalKey<ScanPageStackState> _pages = GlobalKey();

  @override
  void initState() {
    super.initState();
    _drag = ScanPanelDrag(vsync: this);
  }

  @override
  void dispose() {
    _drag.dispose();
    super.dispose();
  }

  void _unfocus() => FocusManager.instance.primaryFocus?.unfocus();

  void _tapOutside() {
    if (MediaQuery.viewInsetsOf(context).bottom > 0) return _unfocus();
    _callbacks.onDismiss?.call();
  }

  void _down(double delta) {
    if (_callbacks.onDismiss != null) _drag.down(delta);
  }

  void _endDown(double velocity) =>
      _drag.endDown(velocity, _callbacks.onDismiss);

  void _endBack(DragEndDetails d) {
    final back = _callbacks.onBack;
    _drag.endBack(
      d.velocity.pixelsPerSecond.dx,
      context.size?.width ?? MediaQuery.sizeOf(context).width,
      back == null
          ? null
          : (progress) {
            _pages.currentState?.handOff(progress);
            back();
          },
    );
  }

  /// The body's scroll at its top, still pulled down: the pull is the
  /// sheet's. Pushed back up, the sheet returns before the body scrolls on.
  /// Only a finger counts (`dragDetails`) — a fling coasting home does not.
  bool _onScroll(ScrollNotification n) {
    if (_callbacks.onDismiss == null || n.metrics.axis != Axis.vertical) {
      return false;
    }
    if (n is OverscrollNotification && n.dragDetails != null) {
      if (n.overscroll < 0 || _drag.isPulledDown) _down(-n.overscroll);
    } else if (n is ScrollUpdateNotification &&
        n.dragDetails != null &&
        _drag.isPulledDown) {
      _down(-(n.scrollDelta ?? 0));
    } else if (n is ScrollEndNotification) {
      _endDown(n.dragDetails?.velocity.pixelsPerSecond.dy ?? 0);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    // Only a deeper page has a level to go back to; a horizontal drag armed
    // on a first-level page would only steal a scroll that set off at a slant.
    final canGoBack = widget.page.level > 0;
    final surface = DecoratedBox(
      decoration: ShapeDecoration(
        color: kPage,
        shape: KalloShapes.squircleTop(kSheetRadius),
        shadows: kSheetShadows,
      ),
      child: Padding(
        padding: EdgeInsets.only(
          bottom: scanSheetBottomInset(MediaQuery.of(context)),
        ),
        child: ScanPageStack(
          key: _pages,
          page: widget.page,
          callbacks: _callbacks,
          dragDx: _drag.offset,
        ),
      ),
    );
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            // Every gesture here repeats a header control (close, back),
            // which is what a screen reader uses; announced as well, these
            // swallowed the header's labels into one merged node.
            excludeFromSemantics: true,
            onTap: _tapOutside,
          ),
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: ValueListenableBuilder<Offset>(
            valueListenable: _drag.offset,
            builder:
                (context, offset, child) => Transform.translate(
                  offset: Offset(0, offset.dy),
                  child: child,
                ),
            child: NotificationListener<ScrollNotification>(
              onNotification: _onScroll,
              child: GestureDetector(
                excludeFromSemantics: true,
                onTap: _unfocus,
                onVerticalDragStart: (_) {
                  if (_callbacks.onDismiss != null) _unfocus();
                },
                onVerticalDragUpdate: (d) => _down(d.delta.dy),
                onVerticalDragEnd:
                    (d) => _endDown(d.velocity.pixelsPerSecond.dy),
                onHorizontalDragUpdate:
                    canGoBack ? (d) => _drag.back(d.delta.dx) : null,
                onHorizontalDragEnd: canGoBack ? _endBack : null,
                child: surface,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
