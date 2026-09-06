/// WeekStrip — the dashboard's always-on 7-day week strip, paged by week.
///
/// The visible week is centered on its anchor (3 days before / 3 after). Page
/// [kWeekPageBase] is today's week and is the LAST page, so the strip swipes
/// unbounded into the past and never past today. Each day shows its weekday
/// abbreviation and date number inside a small **calorie ring** — the accent
/// arc fills with that day's progress toward the target (`consumedRatio` =
/// calories ÷ target, ungated).
///
/// Colouring comes off the 90-day heatmap slice already in the dashboard
/// bundle, so there is no extra fetch. Days OLDER than that window have no
/// heatmap cell: they render uncoloured (track-only ring) but stay fully
/// browsable — the day card behind them fetches its own summary.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/profile/dashboard.dart';
import '../../../logging/logic/timeline_utils.dart';
import '../../data/dashboard_providers.dart';
import '../../logic/dashboard_spacing.dart';
import 'week_day_cell.dart';

class WeekStrip extends ConsumerStatefulWidget {
  const WeekStrip({
    super.key,
    required this.args,
    required this.todayDate,
    required this.selectedDate,
    required this.onSelectDay,
  });

  /// Today-anchored args — the heatmap/ring data stays "as of today" even when
  /// another day is selected.
  final DashboardArgs args;
  final String todayDate;

  /// The day whose summary the Today card is showing (the white chip).
  final String selectedDate;
  final ValueChanged<String> onSelectDay;

  @override
  ConsumerState<WeekStrip> createState() => _WeekStripState();
}

class _WeekStripState extends ConsumerState<WeekStrip> {
  late final PageController _controller = PageController(initialPage: _page);

  int get _page => weekPageForAnchor(widget.todayDate, widget.selectedDate);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(WeekStrip old) {
    super.didUpdateWidget(old);
    if (widget.selectedDate == old.selectedDate) return;
    // Deferred: didUpdateWidget runs before this frame's layout, and a
    // PageController cannot move until its viewport has one.
    final page = _page;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_controller.hasClients) return;
      if (_controller.page?.round() == page) return;
      _controller.jumpToPage(page);
    });
  }

  @override
  Widget build(BuildContext context) {
    // Per-day adherence (ratio + status) keyed by date, off the heatmap slice.
    final heatmap = ref.watch(heatmapProvider(widget.args)).valueOrNull;
    final byDate = <String, HeatmapCell>{};
    for (final row in heatmap?.cells ?? const <List<HeatmapCell>>[]) {
      for (final cell in row) {
        byDate[cell.date] = cell;
      }
    }
    final locale = context.locale.toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: DashboardSpacing.block),
      child: SizedBox(
        height: WeekDayCell.height,
        child: PageView.builder(
          controller: _controller,
          physics: const PageScrollPhysics(),
          itemCount: kWeekPageBase + 1, // page kWeekPageBase == today's week
          itemBuilder: (context, page) {
            final days = buildCenteredStripFromAnchor(
              weekAnchorForPage(widget.todayDate, page),
            ).days;
            return Row(
              children: [
                for (final d in days)
                  Expanded(
                    child: WeekDayCell(
                      date: d,
                      isToday: d == widget.todayDate,
                      isSelected: d == widget.selectedDate,
                      isAfterToday: d.compareTo(widget.todayDate) > 0,
                      cell: byDate[d],
                      locale: locale,
                      onSelectDay: widget.onSelectDay,
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
