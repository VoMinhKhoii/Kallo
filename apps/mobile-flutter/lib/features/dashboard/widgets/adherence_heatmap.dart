/// AdherenceHeatmap — RN port of `components/dashboard/adherence-heatmap.tsx`.
///
/// A server-built grid (read off the dashboard bundle) rendered as a fixed-size
/// grid of rounded cells, tinted via the vendored heatmap colors. Fixed at the
/// 90-day window. No hover tooltip: tapping a logged/partial cell shows its
/// label in a small bubble above the cell. The cell grid is a [CustomPaint]
/// (the RN SVG `<Rect>` grid); the legend is a diverging gradient bar.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/dashboard.dart';
import '../../../shared/widgets/widgets.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/dashboard_providers.dart';
import '../logic/heatmap_colors.dart';
import '../../../theme/calm_tokens.dart';

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
const double _dayLabelWidth = 16;
const double _dayLabelGutter = NhamSpacing.sp1; // gap-1 (4px)
const double _monthStripHeight = 16; // h-4
const double _cellRadius = 3; // rounded-[3px]
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
            padding: const EdgeInsets.all(NhamSpacing.sp4),
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
                const SizedBox(height: NhamSpacing.sp3),
                NhamButton(
                  title: tr('dashboard.retry'),
                  variant: NhamButtonVariant.ghost,
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
        if (cell.status == HeatmapCellStatus.logged && cell.ratio != null) {
          total++;
          if ((cell.ratio! - 1.0).abs() <= 0.1) onTarget++;
        }
      }
    }
    final percent = total > 0 ? ((onTarget / total) * 100).round() : 0;
    return (percent: percent, loggedDays: total);
  }

  double _cellSize(double contentWidth, int numWeeks) {
    if (numWeeks <= 0) return 10;
    final available =
        contentWidth -
        _dayLabelWidth -
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

    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface, // solid white
        borderRadius: BorderRadius.circular(kCardRadius),
        boxShadow: kCardShadows, // shadow only, no border
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final contentWidth = constraints.maxWidth;
          final sq = _cellSize(contentWidth, numWeeks);
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
                padding: const EdgeInsets.only(bottom: NhamSpacing.sp2),
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
                    width: _dayLabelWidth,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var i = 0; i < dayLabels.length; i++)
                          Container(
                            height: sq,
                            margin: EdgeInsets.only(
                              top:
                                  i == 0
                                      ? _monthStripHeight + NhamSpacing.sp1
                                      : _gap90d,
                            ),
                            padding: const EdgeInsets.only(right: 4),
                            alignment: Alignment.centerRight,
                            child: Text(
                              dayLabels[i],
                              style: dashEyebrow(
                                color: kInkMuted,
                                weight: FontWeight.w600,
                              ),
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
                      // Month headers strip.
                      SizedBox(
                        height: _monthStripHeight,
                        width: gridWidth,
                        child: Stack(
                          children: [
                            for (final h
                                in data?.monthHeaders ??
                                    const <HeatmapMonthHeader>[])
                              Positioned(
                                top: 0,
                                left: h.startColumn * step,
                                width:
                                    h.span * sq +
                                    (h.span - 1 > 0 ? h.span - 1 : 0) * _gap90d,
                                child: Text(
                                  h.month,
                                  maxLines: 1,
                                  overflow: TextOverflow.clip,
                                  style: dashEyebrow(
                                    color: kInkMuted,
                                    weight: FontWeight.w600,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: NhamSpacing.sp1),
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
                                    painter: _GridPainter(
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
                              bottom: gridHeight - _bubble!.y + NhamSpacing.sp1,
                              child: Container(
                                constraints: const BoxConstraints(
                                  maxWidth: _bubbleHalfW * 2,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: NhamSpacing.sp1,
                                  horizontal: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: NhamColors.text,
                                  borderRadius: BorderRadius.circular(
                                    NhamRadii.sm,
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
                padding: const EdgeInsets.only(top: NhamSpacing.sp2),
                child: Row(
                  children: [
                    Text(
                      tr('dashboard.adherenceHeatmap.offTarget'),
                      style: dashMeta(color: kInkMuted),
                    ),
                    const SizedBox(width: NhamSpacing.sp2),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(
                          _legendBarHeight / 2,
                        ),
                        child: Container(
                          height: _legendBarHeight,
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                              colors: [
                                HeatmapColors.far,
                                HeatmapColors.moderate,
                                HeatmapColors.slight,
                                HeatmapColors.close,
                                HeatmapColors.onTarget,
                              ],
                              stops: [0, 0.25, 0.5, 0.75, 1],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: NhamSpacing.sp2),
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
        final labelKey = getHeatmapColor(cell.ratio).labelKey;
        final pct = (cell.ratio! * 100).round();
        return '${tr('dashboard.adherenceHeatmap.$labelKey')} · $pct%';
    }
  }
}

/// One cell's solid fill + optional stroke. Three solid states (no fractional
/// opacity multipliers): logged = scale colour, unlogged/partial = neutral
/// track (partial gets a hairline ring), out-of-range = barely-there cream.
({Color fill, Color? stroke}) _cellRectProps(HeatmapCell? cell) {
  final ratio = cell?.ratio;
  final isLogged = cell?.status == HeatmapCellStatus.logged && ratio != null;
  if (isLogged) {
    return (fill: getHeatmapColor(ratio).bg ?? kTrack, stroke: null);
  }
  final isMuted =
      cell?.status == HeatmapCellStatus.future ||
      cell?.status == HeatmapCellStatus.outside;
  if (isMuted) {
    return (fill: kPage, stroke: null); // out-of-range
  }
  final isPartial = cell?.status == HeatmapCellStatus.partial;
  return (fill: kTrack, stroke: isPartial ? kHairline : null);
}

class _GridPainter extends CustomPainter {
  _GridPainter({
    required this.data,
    required this.numWeeks,
    required this.sq,
    required this.step,
    required this.reveal,
    required this.totalMs,
  });

  final HeatmapData? data;
  final int numWeeks;
  final double sq;
  final double step;

  /// Global reveal progress 0→1 across the whole stagger timeline.
  final double reveal;
  final int totalMs;

  // Per-cell tween window (web: duration 0.16s) and stagger increments.
  static const double _cellMs = 160;
  static const double _weekStaggerMs = 10; // wi * 0.01s
  static const double _dayStaggerMs = 5; // di * 0.005s

  @override
  void paint(Canvas canvas, Size size) {
    final fillPaint = Paint()..style = PaintingStyle.fill;
    final strokePaint =
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1;

    final elapsed = reveal * totalMs;

    for (var wi = 0; wi < numWeeks; wi++) {
      for (var di = 0; di < 7; di++) {
        // Local progress for this cell, eased.
        final delay = wi * _weekStaggerMs + di * _dayStaggerMs;
        final raw = ((elapsed - delay) / _cellMs).clamp(0.0, 1.0);
        final p = Curves.easeOut.transform(raw);
        if (p <= 0) continue;
        final scale = 0.6 + 0.4 * p; // scale 0.6 → 1
        final cellAlpha = p; // opacity 0 → 1

        final cell =
            (data != null &&
                    di < data!.cells.length &&
                    wi < data!.cells[di].length)
                ? data!.cells[di][wi]
                : null;
        final props = _cellRectProps(cell);

        // Scale about the cell center.
        final cx = wi * step + sq / 2;
        final cy = di * step + sq / 2;
        final half = (sq * scale) / 2;
        final rect = Rect.fromLTWH(
          cx - half,
          cy - half,
          sq * scale,
          sq * scale,
        );
        final rrect = RRect.fromRectAndRadius(
          rect,
          const Radius.circular(_cellRadius),
        );

        // Solid fill; cellAlpha is only the per-cell reveal fade (→ 1).
        fillPaint.color = props.fill.withValues(alpha: cellAlpha);
        canvas.drawRRect(rrect, fillPaint);

        if (props.stroke != null) {
          strokePaint.color = props.stroke!.withValues(alpha: cellAlpha);
          canvas.drawRRect(rrect, strokePaint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(_GridPainter old) =>
      old.data != data ||
      old.numWeeks != numWeeks ||
      old.sq != sq ||
      old.step != step ||
      old.reveal != reveal ||
      old.totalMs != totalMs;
}
