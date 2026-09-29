import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import 'circle_tab.dart';
import 'tab_layout.dart';

/// The Circle's tab row, edge to edge under the page title (approved canvas
/// "E3", 2026-09-29).
///
/// With a few tabs they share the full width ([tabWidths]); with many, each
/// sits at its minimum and the row scrolls sideways, fading out under its
/// trailing edge while there is more to see. Opening a tab scrolls it into
/// view. The row's height is fixed ([TabGeometry.height]) and a hairline
/// runs under all of it.
class TabStrip extends StatefulWidget {
  const TabStrip({required this.tabs, required this.selected, super.key});

  final List<CircleTab> tabs;

  /// Index of the open tab in [tabs].
  final int selected;

  /// Width of the trailing fade; a tab is only "in view" clear of it.
  static const double fade = 40;

  @override
  State<TabStrip> createState() => _TabStripState();
}

class _TabStripState extends State<TabStrip> {
  final _scroll = ScrollController();

  /// The widths last laid out, for [_reveal]; empty before the first layout.
  List<double> _widths = const [];
  double _rowWidth = 0;

  @override
  void didUpdateWidget(TabStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selected != widget.selected) _reveal();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// Scrolls the open tab into view after this frame's layout. Through the
  /// row's own controller, not `Scrollable.ensureVisible`, which would also
  /// scroll the feed the row sits in.
  void _reveal({bool animate = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      if (widget.selected < 0 || widget.selected >= _widths.length) return;
      final position = _scroll.position;
      final target = revealOffset(
        _widths,
        widget.selected,
        current: position.pixels,
        viewport: position.viewportDimension,
        maxExtent: position.maxScrollExtent,
        fade: TabStrip.fade,
      );
      if ((target - position.pixels).abs() < 0.5) return;
      if (animate) {
        _scroll.animateTo(
          target,
          duration: KalloMotion.page,
          curve: KalloEase.decelerate,
        );
      } else {
        _scroll.jumpTo(target);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final tabs = widget.tabs;
    final labels = [
      for (final tab in tabs) TabGeometry.measure(context, tab.label),
    ];
    final height = TabGeometry.height(
      labels.fold<double>(0, (tallest, size) => math.max(tallest, size.height)),
    );
    return DecoratedBox(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: kHairline)),
      ),
      child: SizedBox(
        height: height,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final widths = tabWidths([
              for (final label in labels) TabGeometry.natural(label.width),
            ], constraints.maxWidth);
            // A rename, a text-size change or a rotation moves the open tab
            // without changing which one it is; bring it back into view.
            if (!listEquals(widths, _widths) ||
                constraints.maxWidth != _rowWidth) {
              _reveal(animate: _widths.isNotEmpty);
              _widths = widths;
              _rowWidth = constraints.maxWidth;
            }
            final overflows =
                widths.fold<double>(0, (sum, w) => sum + w) >
                constraints.maxWidth + 0.5;
            return Stack(
              children: [
                SingleChildScrollView(
                  controller: _scroll,
                  scrollDirection: Axis.horizontal,
                  // Tabs that fit have nowhere to go; a sideways drag on
                  // them must not rubber-band the row.
                  physics:
                      overflows ? null : const NeverScrollableScrollPhysics(),
                  child: Row(
                    children: [
                      for (var i = 0; i < tabs.length; i++)
                        SizedBox(
                          width: widths[i],
                          height: height,
                          child: tabs[i],
                        ),
                    ],
                  ),
                ),
                if (overflows)
                  PositionedDirectional(
                    top: 0,
                    end: 0,
                    // Clear of the hairline, which runs on under the fade.
                    bottom: 1,
                    width: TabStrip.fade,
                    child: IgnorePointer(
                      child: ListenableBuilder(
                        listenable: _scroll,
                        builder:
                            (_, __) => AnimatedOpacity(
                              key: const Key('circle-tabs-fade'),
                              opacity: _atEnd ? 0 : 1,
                              duration: KalloMotion.quick,
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  // Toward the trailing edge, which is
                                  // the left one in a right-to-left locale.
                                  gradient: LinearGradient(
                                    begin: AlignmentDirectional.centerStart,
                                    end: AlignmentDirectional.centerEnd,
                                    colors: [kPage.withValues(alpha: 0), kPage],
                                  ),
                                ),
                              ),
                            ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  bool get _atEnd =>
      _scroll.hasClients &&
      _scroll.position.hasContentDimensions &&
      _scroll.position.extentAfter < 0.5;
}
