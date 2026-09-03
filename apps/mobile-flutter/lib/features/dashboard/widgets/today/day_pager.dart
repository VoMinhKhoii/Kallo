/// The dock's paged day-viewer and the height measurement it needs.
///
/// Split out of `dashboard_screen.dart`, which was over the 400-line ceiling:
/// the pager, its page wrapper and the render object that measures a page are
/// one concern — showing one day at a time without the surrounding scroll view
/// jumping — and the screen only needs the widget at the top of it.
library;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../../theme/kallo_motion.dart';
import '../../logic/day_window.dart';
import 'dock_targets.dart';
import 'today_section.dart';

/// The paged day-viewer: a PageView of [TodaySection]s, one per browsable day,
/// synced to the week strip. Swiping or tapping a strip day moves the page.
///
/// The window is unbounded into the past and clamped at today, so pages are
/// mapped to dates by [dateForPage] rather than indexed into a list — see
/// `logic/day_window.dart`.
///
/// A PageView needs a bounded height, but each day's card differs in height
/// (different meal counts). Each page reports its measured height; the pager
/// animates its own height to the active page so the surrounding ListView
/// reflows smoothly instead of the card being clipped or over-tall.
class DayPager extends StatefulWidget {
  const DayPager({
    super.key,
    required this.controller,
    required this.dateForPage,
    required this.todayPage,
    required this.userId,
    required this.targets,
    required this.onPageChanged,
    required this.dateLabel,
  });

  final PageController controller;
  /// Page index → the YYYY-MM-DD date that page shows.
  final String Function(int page) dateForPage;
  final int todayPage;
  final String userId;
  final DockTargets targets;
  final ValueChanged<int> onPageChanged;
  final String Function(String date) dateLabel;

  @override
  State<DayPager> createState() => DayPagerState();
}

class DayPagerState extends State<DayPager> {
  // Sparse by page index: the pager has thousands of pages and at most a
  // handful are ever laid out, so a filled list would be all nulls.
  final Map<int, double> _heights = {};
  late int _active = widget.todayPage;

  void _report(int index, double height) {
    if (_heights[index] == height) return;
    // Defer the setState out of the layout/build phase.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _heights[index] = height);
    });
  }

  @override
  Widget build(BuildContext context) {
    // While a page is unmeasured, fall back to the tallest known height (or a
    // sensible minimum) so the first frame isn't zero-height.
    final known = _heights.values;
    final fallback =
        known.isEmpty ? 280.0 : known.reduce((a, b) => a > b ? a : b);
    final height = _heights[_active] ?? fallback;

    // Clip.none the whole way down. The viewport is EXACTLY the card's measured
    // height, so every default Clip.hardEdge here (AnimatedSize's, the
    // PageView's, _MeasuredPage's) put a clip rect on the card's own rect and
    // sheared kCardShadows off all four sides — the Today card read hard-edged
    // while its neighbours floated. Nothing on this path needs to clip: the
    // ListView viewport still bounds the scroll.
    return AnimatedSize(
      duration: KalloMotion.quick,
      curve: KalloEase.decelerate,
      alignment: Alignment.topCenter,
      clipBehavior: Clip.none,
      child: SizedBox(
        height: height,
        child: PageView.builder(
          clipBehavior: Clip.none,
          controller: widget.controller,
          itemCount: kDayPageBase + 1,
          onPageChanged: (p) {
            setState(() => _active = p);
            widget.onPageChanged(p);
          },
          itemBuilder: (context, index) {
            final date = widget.dateForPage(index);
            return _MeasuredPage(
              onHeight: (h) => _report(index, h),
              child: TodaySection(
                args: (userId: widget.userId, date: date),
                targets: widget.targets,
                dateLabel: widget.dateLabel(date),
                isToday: index == widget.todayPage,
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Reports its child's laid-out height once per layout pass, top-aligned so the
/// card sits at the top of the (taller) page viewport.
class _MeasuredPage extends StatelessWidget {
  const _MeasuredPage({required this.child, required this.onHeight});
  final Widget child;
  final ValueChanged<double> onHeight;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      clipBehavior: Clip.none, // let the card's shadow out (see DayPager)
      child: _SizeReporter(onHeight: onHeight, child: child),
    );
  }
}

class _SizeReporter extends SingleChildRenderObjectWidget {
  const _SizeReporter({required this.onHeight, required super.child});
  final ValueChanged<double> onHeight;

  @override
  _SizeReporterRender createRenderObject(BuildContext context) =>
      _SizeReporterRender(onHeight);

  @override
  void updateRenderObject(BuildContext context, _SizeReporterRender obj) =>
      obj.onHeight = onHeight;
}

class _SizeReporterRender extends RenderProxyBox {
  _SizeReporterRender(this.onHeight);
  ValueChanged<double> onHeight;
  double? _last;

  @override
  void performLayout() {
    super.performLayout();
    final h = size.height;
    if (h != _last) {
      _last = h;
      onHeight(h);
    }
  }
}
