import '../../../shared/widgets/panes/pane_insets.dart';
import '../../../shared/widgets/panes/pane_slot.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../shared/widgets/panes/pane_scroll.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../theme/kallo_motion.dart';
import '../../logging/logic/timeline_utils.dart' hide WeekStrip;
import '../data/dashboard_providers.dart';
import '../logic/day_window.dart';
import '../logic/dashboard_spacing.dart';
import '../widgets/heatmap/adherence_heatmap.dart';
import '../widgets/today/dock_targets.dart';
import '../widgets/today/day_pager.dart';
import '../widgets/today/today_section.dart';
import '../widgets/chrome/week_strip.dart';
import '../widgets/weight/weight_chart.dart';
import '../../../shell/window/two_pane_transition.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shared/widgets/panes/two_pane_scaffold.dart';

import '../widgets/chrome/dashboard_section.dart';

class DashboardContent extends StatefulWidget {
  const DashboardContent({
    super.key,
    required this.args,
    required this.todayDate,
    required this.targets,
    required this.isFirstRun,
    required this.onRefresh,
  });

  /// Pull-to-refresh: refetches the one aggregate the whole screen reads.
  final Future<void> Function() onRefresh;

  /// Today-anchored args — Progress (30d), Consistency (90d) and the week
  /// strip's rings stay "as of today" regardless of the selected day.
  final DashboardArgs args;
  final String todayDate;
  final DockTargets targets;
  final bool isFirstRun;

  @override
  State<DashboardContent> createState() => DashboardContentState();
}

class DashboardContentState extends State<DashboardContent>
    with TwoPaneTransition {
  // The day whose summary the Today card shows; tapping a strip day or swiping
  // the card changes it. The window is unbounded into the past and clamped at
  // today, so pages map to dates through `logic/day_window.dart` instead of
  // indexing a fixed list — today is [kDayPageBase], the last page.
  int _page = kDayPageBase;
  final _pagerKey = GlobalKey();

  // One key per pane, so a fold or a rotation moves each scroll view and its
  // offset to its new place in the tree (see [PaneScroll]).
  final _farKey = GlobalKey(debugLabel: 'dashboard-far');
  final _nearKey = GlobalKey(debugLabel: 'dashboard-near');
  final _progressKey = GlobalKey();
  bool _nearTouchedLast = false;
  final PageController _pageController = PageController(
    initialPage: kDayPageBase,
  );

  String get _selectedDate => dateForDayPage(widget.todayDate, _page);

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Strip tap → animate the day card to that page (selection haptic fires in
  /// the strip's own GestureDetector). Days after today have no page.
  ///
  /// First-run renders the static FirstRunCard instead of the DayPager, so the
  /// controller has no PageView to drive — `animateToPage` / `jumpToPage` then
  /// throw `StateError: No element` (Sentry KALLO-MOBILE-1). A new user has
  /// only today to show, so the tap is a no-op until the pager mounts.
  void _onSelectDay(String date) {
    if (!_pageController.hasClients) return;
    final page = dayPageForDate(widget.todayDate, date);
    if (page == _page || page < 0 || page > kDayPageBase) return;
    // Animating across many pages builds every intermediate day, and each one
    // fetches `/api/v1/logging/day` — jump straight there beyond a neighbour.
    if ((page - _page).abs() > 1) {
      _pageController.jumpToPage(page);
      return;
    }
    _pageController.animateToPage(
      page,
      duration: KalloMotion.page,
      curve: KalloEase.decelerate,
    );
  }

  /// Closing the phone while the Progress pane was in use lands on Progress,
  /// not back at the top of the day.
  ///
  /// Two frames late on purpose: the first lays the single column out at its
  /// new width, and the day card only reports its height on the one after. An
  /// offset taken any earlier is short by however much that card grew. This
  /// runs after the first; the scroll waits for the second.
  @override
  void onTwoPaneChanged(bool wasTwoPane) {
    if (!wasTwoPane || !_nearTouchedLast) return;
    final binding = WidgetsBinding.instance;
    binding.addPostFrameCallback((_) {
      final target = _progressKey.currentContext;
      if (mounted && target != null) Scrollable.ensureVisible(target);
    });
    binding.scheduleFrame();
  }

  /// Swipe → update selection + fire the same selection haptic the strip uses.
  void _onPageChanged(int page) {
    if (page == _page) return;
    HapticFeedback.selectionClick();
    setState(() => _page = page);
  }

  /// A human date line for the card: "Today" / "Yesterday" / a localized
  /// weekday-month-day (e.g. "Mon, Jun 9").
  String _dateLabel(String date, String locale) {
    if (date == widget.todayDate) return tr('dashboard.today');
    if (date == addDays(widget.todayDate, -1)) {
      return tr('dashboard.yesterday');
    }
    return DateFormat('EEE, MMM d', locale).format(dateStringToDate(date));
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final layout = WindowLayout.of(context);

    final children = <Widget>[
      // SECTION 1 — week strip + the paged day-viewer (the wordmark
      // lives in the header row, beside the avatar).
      WeekStrip(
        args: widget.args,
        todayDate: widget.todayDate,
        selectedDate: _selectedDate,
        onSelectDay: _onSelectDay,
      ),
      // No trailing margin: each _Section below pays its own break.
      if (widget.isFirstRun)
        TodaySection(
          args: widget.args,
          targets: widget.targets,
          dateLabel: _dateLabel(widget.todayDate, locale),
          isFirstRun: true,
        )
      else
        Semantics(
          key: _pagerKey,
          container: true,
          child: DayPager(
            controller: _pageController,
            todayDate: widget.todayDate,
            userId: widget.args.userId,
            targets: widget.targets,
            onPageChanged: _onPageChanged,
            dateLabel: (d) => _dateLabel(d, locale),
          ),
        ),
      // SECTION 2 — Progress.
      DashboardSection(
        top: layout.twoPane ? 0 : DashboardSpacing.sectionBreak,
        children: [
          Semantics(
            key: _progressKey,
            container: true,
            child: SectionHeaderRow(
              title: tr('dashboard.progress'),
              meta: tr('dashboard.ranges.thirtyDays'),
            ),
          ),
          WeightChart(args: widget.args),
        ],
      ),
      // SECTION 3 — Consistency. The padding's bottom is the nav
      // clearance, so the scroll ends right under the heatmap.
      DashboardSection(
        children: [
          // No meta here: the heatmap card states its own window in
          // its "{percent}% on track · {window}" line, and unlike a
          // static header that line TRACKS the range the layout
          // resolved to. A fixed "90 days" up here both repeated it
          // and would have gone on claiming 90 days on a tablet that
          // had stepped up to the year.
          SectionHeaderRow(title: tr('dashboard.consistency')),
          AdherenceHeatmap(args: widget.args),
        ],
      ),
    ];
    Widget scroll(
      List<Widget> items,
      bool near,
      EdgeInsets padding,
    ) => NotificationListener<ScrollStartNotification>(
      onNotification: (notification) {
        if (notification.depth == 0 && notification.dragDetails != null) {
          _nearTouchedLast = near;
        }
        return false;
      },
      // Bouncing physics and refresh as the first sliver hold the page down
      // for the whole refetch, rather than releasing it before data arrives.
      child: PaneScroll(
        key: near ? _nearKey : _farKey,
        onRefresh: widget.onRefresh,
        slivers:
            (bottom) => [
              SliverPadding(
                // The shell extends behind its floating nav. Its measured
                // height arrives here as bottom clearance, including insets.
                padding: padding.copyWith(bottom: bottom),
                // Built in full, not lazily: there are five children at
                // most, and a lazy list leaves Progress unbuilt while it is
                // off screen, with nothing for the reveal above to scroll to.
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: items,
                  ),
                ),
              ),
            ],
      ),
    );
    return TwoPaneScaffold(
      single: scroll(
        children,
        false,
        // AppHeader pays 4 below itself; 8 here completes the 12pt rhythm.
        paneInsets(context, slot: PaneSlot.single, top: 8),
      ),
      far: scroll(
        children.take(2).toList(),
        false,
        paneInsets(context, slot: PaneSlot.far),
      ),
      near: scroll(
        children.skip(2).toList(),
        true,
        paneInsets(context, slot: PaneSlot.near),
      ),
    );
  }
}
