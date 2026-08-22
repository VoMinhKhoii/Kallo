/// AdherenceHeatmap — RN port of `components/dashboard/adherence-heatmap.tsx`.
///
/// A server-built grid (read off the dashboard bundle) rendered as a fixed-size
/// grid of rounded cells, tinted via the vendored heatmap colors. Fixed at the
/// 90-day window. No hover tooltip: tapping a logged/partial cell shows its
/// label in a small bubble above the cell. The cell grid is a [CustomPaint]
/// ([HeatmapGridPainter]); the legend is a diverging gradient bar. Month-strip
/// positioning lives in `logic/heatmap_month_labels.dart`.
library;

import 'dart:ui' as ui;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/profile/dashboard.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/dashboard_providers.dart';
import '../../logic/heatmap_colors.dart';
import '../../logic/heatmap_month_labels.dart';
import 'heatmap_grid_painter.dart';
import '../../../../theme/calm_tokens.dart';

/// Monday-first narrow weekday initials for [locale] (en → M T W T F S S; vi →
/// the localized initials). Anchored on a known Monday so DST/locale offsets
/// can't shift the order.
List<String> _weekdayInitials(String locale) {
  // 2024-01-01 is a Monday.
  final monday = DateTime(2024, 1, 1);
  final fmt = DateFormat('EEEEE', locale); // narrow weekday
  return [
    for (var i = 0; i < 7; i++) fmt.format(monday.add(Duration(days: i))),
  ];
}

const double _gap90d = 2; // GAP['90d']
/// Floor for the weekday gutter; the real width is measured, because narrow
/// weekday names are not one character in every language — Vietnamese renders
/// `T2`…`T7`, `CN`, which wrapped to two lines inside a fixed 16.
const double _minDayLabelWidth = 16;
const double _dayLabelPadRight = 4;
const double _dayLabelGutter = KalloSpacing.sp1; // gap-1 (4px)
const double _monthStripHeight = 16; // h-4
const double _bubbleHalfW = 60;
const double _legendBarHeight = 6;

class AdherenceHeatmap extends ConsumerWidget {
  const AdherenceHeatmap({super.key, required this.args});

  final DashboardArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(heatmapProvider(args));

    return async.when(
      loading: () => const _HeatmapBody(data: null),
      // Empty/loaded both render the grid; the server always returns a full
      // grid for the range (unlogged days are the "not logged" track).
      data: (data) => _HeatmapBody(data: data),
      error:
          (_, __) => Container(
            constraints: const BoxConstraints(minHeight: 180),
            alignment: Alignment.center,
            padding: const EdgeInsets.all(KalloSpacing.sp4),
            decoration: BoxDecoration(
              color: kCardSurface,
              borderRadius: BorderRadius.circular(kCardRadius),
              boxShadow: kCardShadows,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 280),
                  child: Text(
                    tr('dashboard.heatmapLoadError'),
                    textAlign: TextAlign.center,
                    style: dashMeta(color: kInkMuted),
                  ),
                ),
                const SizedBox(height: KalloSpacing.sp3),
                KalloButton(
                  title: tr('dashboard.retry'),
                  variant: KalloButtonVariant.ghost,
                  onPressed:
                      () => ref.invalidate(dashboardBundleProvider(args)),
                ),
              ],
            ),
          ),
    );
  }
}

class _Bubble {
  const _Bubble(this.text, this.x, this.y);
  final String text;
  final double x; // center x of the cell (grid-local)
  final double y; // top y of the cell (grid-local)
}

class _HeatmapBody extends StatefulWidget {
  const _HeatmapBody({required this.data});
  final HeatmapData? data;

  @override
  State<_HeatmapBody> createState() => _HeatmapBodyState();
}

class _HeatmapBodyState extends State<_HeatmapBody>
    with SingleTickerProviderStateMixin {
  _Bubble? _bubble;

  // Per-cell wave reveal: each cell animates {opacity:0,scale:0.6}→{1,1} over
  // 0.16s with a stagger delay of wi*0.01 + di*0.005. The controller spans the
  // full timeline (max delay + 0.16s); the painter derives each cell's local
  // progress from [_reveal].value. Total ≈ (numWeeks-1)*0.01 + 6*0.005 + 0.16s.
  late final int _staggerMs = ((_numWeeks - 1) * 10 + 6 * 5 + 160).clamp(
    160,
    5000,
  );
  late final AnimationController _reveal = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: _staggerMs),
  )..forward();

  @override
  void dispose() {
    _reveal.dispose();
    super.dispose();
  }

  int get _numWeeks {
    final data = widget.data;
    if (data == null) return 14; // 90d skeleton nominal width
    return data.cells.isNotEmpty ? data.cells[0].length : 0;
  }

  /// (onTrackPercent, loggedDayCount). The percent is meaningless with zero
  /// logged days — the count gates whether the "% on track" line renders.
  ({int percent, int loggedDays}) get _adherence {
    final data = widget.data;
    if (data == null) return (percent: 0, loggedDays: 0);
    var onTarget = 0;
    var total = 0;
    for (final row in data.cells) {
      for (final cell in row) {
        // Cheat days are neutral: they intentionally exceed target, so they
        // count as neither a hit nor a miss for the adherence rate.
        if (cell.status == HeatmapCellStatus.logged &&
            cell.ratio != null &&
            !cell.hasCheatMeal) {
          total++;
          // Ask the classifier, don't re-derive a threshold: the bands are
          // asymmetric now, so a single number cannot express "green or
          // light green" any more.
          if (HeatmapBands.onTrackLabels.contains(
            getHeatmapColor(cell.ratio).labelKey,
          )) {
            onTarget++;
          }
        }
      }
    }
    final percent = total > 0 ? ((onTarget / total) * 100).round() : 0;
    return (percent: percent, loggedDays: total);
  }

  /// The widest weekday label in the active locale, plus its inset.
  double _dayLabelWidth(List<String> labels, TextStyle style) {
    var widest = 0.0;
    for (final label in labels) {
      final painter = TextPainter(
        text: TextSpan(text: label, style: style),
        textDirection: ui.TextDirection.ltr,
        maxLines: 1,
      )..layout();
      if (painter.width > widest) widest = painter.width;
    }
    final needed = widest + _dayLabelPadRight;
    return needed > _minDayLabelWidth ? needed.ceilToDouble() : _minDayLabelWidth;
  }

  double _cellSize(double contentWidth, int numWeeks, double dayLabelWidth) {
    if (numWeeks <= 0) return 10;
    final available =
        contentWidth -
        dayLabelWidth -
        _dayLabelGutter -
        (numWeeks - 1) * _gap90d;
    final sq = (available / numWeeks).floorToDouble();
    return sq < 10 ? 10 : sq;
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final numWeeks = _numWeeks;
    final dayLabels = _weekdayInitials(context.locale.toString());
    final monthLabelStyle = dashMeta(color: kInkMuted);
    final dayLabelStyle = dashMeta(color: kInkMuted);
    final dayLabelWidth = _dayLabelWidth(dayLabels, dayLabelStyle);

    return Container(
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface, // solid white
        borderRadius: BorderRadius.circular(kCardRadius),
        boxShadow: kCardShadows, // shadow only, no border
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final contentWidth = constraints.maxWidth;
          final sq = _cellSize(contentWidth, numWeeks, dayLabelWidth);
          final step = sq + _gap90d;
          final gridWidth =
              numWeeks > 0 ? numWeeks * sq + (numWeeks - 1) * _gap90d : 0.0;
          final gridHeight = 7 * sq + 6 * _gap90d;
          final adherence = _adherence;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: "{percent}% on track". Suppressed until at least 3
              // scored days (spec) — a percentage computed from one or two
              // days reads as noise, and a new user shouldn't see "0% on
              // track" over an empty grid.
              Padding(
                padding: const EdgeInsets.only(bottom: KalloSpacing.sp2),
                child: Text(
                  (data != null && adherence.loggedDays >= 3)
                      ? tr(
                        'dashboard.adherenceHeatmap.onTrack',
                        namedArgs: {'percent': '${adherence.percent}'},
                      )
                      : ' ',
                  style: dashMeta(color: kInk, tabular: true),
                ),
              ),

              // Day-labels column + (month strip over cell grid).
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Day labels.
                  SizedBox(
                    width: dayLabelWidth,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var i = 0; i < dayLabels.length; i++)
                          Container(
                            height: sq,
                            margin: EdgeInsets.only(
                              top:
                                  i == 0
                                      ? _monthStripHeight + KalloSpacing.sp1
                                      : _gap90d,
                            ),
                            padding: const EdgeInsets.only(
                              right: _dayLabelPadRight,
                            ),
                            alignment: Alignment.centerRight,
                            child: Text(
                              dayLabels[i],
                              maxLines: 1,
                              softWrap: false,
                              overflow: TextOverflow.visible,
                              style: dayLabelStyle,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: _dayLabelGutter),
                  // Month strip + grid.
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Month headers strip. Positions come from
                      // `layoutMonthLabels`, which shifts colliding headers
                      // and drops the ones too narrow to label — two months
                      // can otherwise share a startColumn and paint on top of
                      // each other.
                      SizedBox(
                        height: _monthStripHeight,
                        width: gridWidth,
                        child: Stack(
                          children: [
                            for (final box in layoutMonthLabels(
                              headers:
                                  data?.monthHeaders ??
                                  const <HeatmapMonthHeader>[],
                              cellSize: sq,
                              gap: _gap90d,
                              gridWidth: gridWidth,
                              style: monthLabelStyle,
                              locale: context.locale.toString(),
                              textScaler: MediaQuery.textScalerOf(context),
                            ))
                              Positioned(
                                top: 0,
                                left: box.left,
                                width: box.width,
                                child: Text(
                                  box.month,
                                  maxLines: 1,
                                  softWrap: false,
                                  overflow: TextOverflow.clip,
                                  style: monthLabelStyle,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: KalloSpacing.sp1),
                      // Cell grid.
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTapUp:
                                data == null
                                    ? null
                                    : (details) => _handleTap(
                                      details.localPosition,
                                      data,
                                      sq,
                                      step,
                                      numWeeks,
                                    ),
                            child: AnimatedBuilder(
                              animation: _reveal,
                              builder:
                                  (context, _) => CustomPaint(
                                    size: Size(gridWidth, gridHeight),
                                    painter: HeatmapGridPainter(
                                      data: data,
                                      numWeeks: numWeeks,
                                      sq: sq,
                                      step: step,
                                      // Drive the per-cell wave reveal.
                                      reveal: _reveal.value,
                                      totalMs: _staggerMs,
                                    ),
                                  ),
                            ),
                          ),
                          if (_bubble != null)
                            Positioned(
                              left: (_bubble!.x - _bubbleHalfW).clamp(
                                0,
                                (gridWidth - _bubbleHalfW * 2).clamp(
                                  0,
                                  double.infinity,
                                ),
                              ),
                              bottom: gridHeight - _bubble!.y + KalloSpacing.sp1,
                              child: Container(
                                constraints: const BoxConstraints(
                                  maxWidth: _bubbleHalfW * 2,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: KalloSpacing.sp1,
                                  horizontal: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: KalloColors.text,
                                  borderRadius: BorderRadius.circular(
                                    KalloRadii.sm,
                                  ),
                                ),
                                child: Text(
                                  _bubble!.text,
                                  textAlign: TextAlign.center,
                                  style: dashMeta(color: Colors.white),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),

              // Legend.
              Padding(
                padding: const EdgeInsets.only(top: KalloSpacing.sp2),
                child: Row(
                  children: [
                    Text(
                      tr('dashboard.adherenceHeatmap.offTarget'),
                      style: dashMeta(color: kInkMuted),
                    ),
                    const SizedBox(width: KalloSpacing.sp2),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(
                          _legendBarHeight / 2,
                        ),
                        child: Container(
                          height: _legendBarHeight,
                          decoration: const BoxDecoration(
                            // Five equal discrete segments, one per tier — the
                            // same five flat colours the cells use, each
                            // repeated so its slice has hard edges.
                            gradient: LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                              colors: [
                                HeatmapColors.far, HeatmapColors.far,
                                HeatmapColors.moderate, HeatmapColors.moderate,
                                HeatmapColors.slight, HeatmapColors.slight,
                                HeatmapColors.close, HeatmapColors.close,
                                HeatmapColors.onTarget, HeatmapColors.onTarget,
                              ],
                              stops: HeatmapBands.legendStops,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: KalloSpacing.sp2),
                    Text(
                      tr('dashboard.adherenceHeatmap.onTarget'),
                      style: dashMeta(color: kInkMuted),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _handleTap(
    Offset pos,
    HeatmapData data,
    double sq,
    double step,
    int numWeeks,
  ) {
    final wi = (pos.dx / step).floor();
    final di = (pos.dy / step).floor();
    if (wi < 0 || wi >= numWeeks || di < 0 || di >= 7) return;
    final cell =
        (di < data.cells.length && wi < data.cells[di].length)
            ? data.cells[di][wi]
            : null;
    if (cell == null) return;

    final isLogged =
        cell.status == HeatmapCellStatus.logged && cell.ratio != null;
    final isPartial = cell.status == HeatmapCellStatus.partial;
    final isMuted =
        cell.status == HeatmapCellStatus.future ||
        cell.status == HeatmapCellStatus.outside;
    if (!((isLogged || isPartial) && !isMuted)) return;

    final text = _tooltipText(cell);
    final x = wi * step + sq / 2;
    final y = di * step;
    setState(() {
      final prev = _bubble;
      _bubble =
          (prev != null && prev.text == text && prev.x == x && prev.y == y)
              ? null
              : _Bubble(text, x, y);
    });
  }

  String _tooltipText(HeatmapCell cell) {
    switch (cell.status) {
      case HeatmapCellStatus.future:
        return tr('dashboard.adherenceHeatmap.future');
      case HeatmapCellStatus.outside:
        return tr('dashboard.adherenceHeatmap.outside');
      case HeatmapCellStatus.partial:
        return tr('dashboard.adherenceHeatmap.partial');
      case HeatmapCellStatus.unlogged:
        return tr('dashboard.adherenceHeatmap.notLogged');
      case HeatmapCellStatus.logged:
        if (cell.ratio == null) {
          return tr('dashboard.adherenceHeatmap.notLogged');
        }
        if (cell.hasCheatMeal) {
          return tr('dashboard.adherenceHeatmap.cheatDay');
        }
        final labelKey = getHeatmapColor(cell.ratio).labelKey;
        final pct = (cell.ratio! * 100).round();
        return '${tr('dashboard.adherenceHeatmap.$labelKey')} · $pct%';
    }
  }
}
