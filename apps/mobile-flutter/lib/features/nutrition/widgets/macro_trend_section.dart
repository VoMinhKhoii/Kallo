import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../models/nutrition.dart';
import '../logic/bucket_detail.dart';
import 'bucket_detail.dart';
import 'macro_trend_chart.dart';

/// The trend chart plus the breakdown panel for whichever column is tapped.
/// Owns the selection so `DaySummary` stays a layout: tapping a column opens
/// that bucket's macros and micronutrients, tapping it again closes them.
class MacroTrendSection extends StatefulWidget {
  const MacroTrendSection({super.key, required this.daySeries});

  final NutritionDaySeries daySeries;

  @override
  State<MacroTrendSection> createState() => _MacroTrendSectionState();
}

class _MacroTrendSectionState extends State<MacroTrendSection> {
  int? _selectedIndex;

  @override
  void didUpdateWidget(MacroTrendSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A new range or day scope re-buckets the axis, so an index picked against
    // the old one would point at an unrelated column.
    if (!identical(oldWidget.daySeries, widget.daySeries)) {
      _selectedIndex = null;
    }
  }

  void _select(int index) {
    HapticFeedback.selectionClick();
    setState(() => _selectedIndex = _selectedIndex == index ? null : index);
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final buckets = widget.daySeries.series.isEmpty
        ? const <DaySeriesBucket>[]
        : widget.daySeries.series.first.buckets;
    final todayIndex = findTodayIndex(buckets, localIsoDate());
    final selected = _selectedIndex;
    final detail = selected == null
        ? null
        : buildBucketDetail(widget.daySeries, selected);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MacroTrendChart(
          daySeries: widget.daySeries,
          todayIndex: todayIndex,
          selectedIndex: selected,
          onSelect: _select,
        ),
        if (detail != null)
          BucketDetail(
            detail: detail,
            locale: locale,
            onClose: () => setState(() => _selectedIndex = null),
          ),
      ],
    );
  }
}
