/// AdherenceHeatmap — RN port of `components/dashboard/adherence-heatmap.tsx`.
///
/// A server-built grid (read off the dashboard bundle) rendered as a fixed-size
/// grid of rounded cells, tinted via the vendored heatmap colors. Fixed at the
/// 90-day window. No hover tooltip: tapping a logged/partial cell shows its
/// label in a small bubble above the cell. The cell grid is a [CustomPaint]
/// ([HeatmapGridPainter]); the legend is a diverging gradient bar. The month
/// headers are [HeatmapMonthStrip], which also owns the strip's height.
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
import '../../logic/dashboard_spacing.dart';
import '../../logic/heatmap_colors.dart';
import '../../logic/heatmap_range.dart';
import 'heatmap_grid_painter.dart';
import 'heatmap_legend.dart';
import 'heatmap_month_strip.dart';
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

/// Floor for the weekday gutter; the real width is measured, because narrow
/// weekday names are not one character in every language — Vietnamese renders
/// `T2`…`T7`, `CN`, which wrapped to two lines inside a fixed 16.
const double _minDayLabelWidth = 16;
const double _dayLabelPadRight = 4;
const double _dayLabelGutter = KalloSpacing.sp1; // gap-1 (4px)
const double _bubbleHalfW = 60;

class AdherenceHeatmap extends ConsumerWidget {
  const AdherenceHeatmap({super.key, required this.args});

  final DashboardArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(heatmapProvider(args));
    // Only the card knows how wide it is, and the provider decides what to
    // fetch — so the measurement has to travel back up. Keyed on the resolved
    // RANGE, so a resize within one range changes nothing.
    void resolve(HeatmapRange range) {
      if (ref.read(heatmapRangeProvider) == range) return;
      ref.read(heatmapRangeProvider.notifier).state = range;
    }

    return async.when(
      // A weigh-in invalidates the bundle, so heatmapProvider goes isReloading
      // and .when would drop the drawn grid back to its loading body —
      // skipLoadingOnReload only defaults true on refresh.
      skipLoadingOnReload: true,
      loading: () => _HeatmapBody(data: null, onRangeResolved: resolve),
      // Empty/loaded both render the grid; the server always returns a full
      // grid for the range (unlogged days are the "not logged" track).
      data: (data) => _HeatmapBody(data: data, onRangeResolved: resolve),
      error:
          (_, __) => KalloCard(
            padding: DashboardSpacing.card,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 180),
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
                  const SizedBox(height: DashboardSpacing.section),
                  KalloButton(
                    title: tr('dashboard.retry'),
                    onPressed:
                        () => ref.invalidate(dashboardBundleProvider(args)),
                  ),
                ],
              ),
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
  const _HeatmapBody({required this.data, required this.onRangeResolved});
  final HeatmapData? data;
  final ValueChanged<HeatmapRange> onRangeResolved;

  @override
  State<_HeatmapBody> createState() => _HeatmapBodyState();
}

class _HeatmapBodyState extends State<_HeatmapBody>
    with SingleTickerProviderStateMixin {
  _Bubble? _bubble;

  /// The last range reported upward, so a resize inside one range is silent.
  HeatmapRange? _lastResolved;

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
  double _dayLabelWidth(
    List<String> labels,
    TextStyle style,
    TextScaler scaler,
  ) {
    var widest = 0.0;
    for (final label in labels) {
      final painter = TextPainter(
        text: TextSpan(text: label, style: style),
        textDirection: ui.TextDirection.ltr,
        textScaler: scaler,
        maxLines: 1,
      )..layout();
      if (painter.width > widest) widest = painter.width;
      painter.dispose();
    }
    final needed = widest + _dayLabelPadRight;
    return needed > _minDayLabelWidth ? needed.ceilToDouble() : _minDayLabelWidth;
  }

  /// Cell edge for the width we were handed.
  ///
  /// Clamped at BOTH ends. The floor keeps a narrow phone legible; the ceiling
  /// is what stops a tablet inflating the 90-day grid into ~51px tiles whose
  /// gutters vanish — extra width should buy history (a wider range, chosen in
  /// [_resolveRange]), never bigger squares.
  double _cellSize(
    double contentWidth,
    int numWeeks,
    double dayLabelWidth,
    HeatmapRange range,
  ) {
    if (numWeeks <= 0) return 10;
    final gap = heatmapCellGap[range]!;
    final available =
        contentWidth - dayLabelWidth - _dayLabelGutter - (numWeeks - 1) * gap;
    final sq = (available / numWeeks).floorToDouble();
    return sq.clamp(10, heatmapMaxCell[range]!);
  }

  /// Tell the provider which range this width can carry, once per change.
  void _resolveRange(double contentWidth, double dayLabelWidth) {
    final range = chooseRenderedHeatmapRange(
      preferredRange: HeatmapRange.year,
      availableWidth: contentWidth - dayLabelWidth - _dayLabelGutter,
    );
    if (range == _lastResolved) return;
    _lastResolved = range;
    // During layout — deferred, or it would mutate a provider mid-build.
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.onRangeResolved(range),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final numWeeks = _numWeeks;
    final dayLabels = _weekdayInitials(context.locale.toString());
    final monthLabelStyle = dashMeta(color: kInkMuted);
    final dayLabelStyle = dashMeta(color: kInkMuted);
    // One scaler for the whole card: the gutter has to be measured at the same
    // text scale it will paint at (it was measured at 1.0 and wrapped `T2`…`CN`
    // once the user scaled up), and the month strip's height is derived from it.
    final scaler = MediaQuery.textScalerOf(context);
    final dayLabelWidth = _dayLabelWidth(dayLabels, dayLabelStyle, scaler);
    final monthStripHeight =
        HeatmapMonthStrip.heightFor(monthLabelStyle, scaler);

    return KalloCard(
      padding: DashboardSpacing.card,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final contentWidth = constraints.maxWidth;
          _resolveRange(contentWidth, dayLabelWidth);
          // Geometry follows the data actually on screen, not the range the
          // width just asked for — those differ for one frame while the wider
          // request is in flight.
          final range = heatmapRangeForColumns(numWeeks);
          final gap = heatmapCellGap[range]!;
          final sq = _cellSize(contentWidth, numWeeks, dayLabelWidth, range);
          final step = sq + gap;
          final gridWidth =
              numWeeks > 0 ? numWeeks * sq + (numWeeks - 1) * gap : 0.0;
          final gridHeight = 7 * sq + 6 * gap;
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
                        namedArgs: {
                          'percent': '${adherence.percent}',
                          // The window is part of the claim: the same account
                          // scores differently over 90 days and over a year,
                          // and a wide layout silently shows the wider one.
                          'window': tr(
                            'dashboard.adherenceHeatmap.window.${range.name}',
                          ),
                        },
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
                                      ? monthStripHeight + KalloSpacing.sp1
                                      : gap,
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
                      HeatmapMonthStrip(
                        headers:
                            data?.monthHeaders ??
                            const <HeatmapMonthHeader>[],
                        cellSize: sq,
                        gap: gap,
                        gridWidth: gridWidth,
                        style: monthLabelStyle,
                        height: monthStripHeight,
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

              const HeatmapLegend(),
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
