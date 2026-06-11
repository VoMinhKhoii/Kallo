import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/meal.dart';
import '../../../models/streaming.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../logic/format.dart';
import 'dashed_divider.dart';
import 'entrances.dart';
import 'timeline_rail.dart';

// Statuses that map to a localized phase label; others fall back to "Analyzing".
const _phaseKeys = {
  StreamStatus.connecting,
  StreamStatus.decomposing,
  StreamStatus.matching,
  StreamStatus.estimating,
  StreamStatus.assembling,
};

String _phaseKey(StreamStatus status) => switch (status) {
      StreamStatus.connecting => 'logging.streaming.connecting',
      StreamStatus.decomposing => 'logging.streaming.decomposing',
      StreamStatus.matching => 'logging.streaming.matching',
      StreamStatus.estimating => 'logging.streaming.estimating',
      StreamStatus.assembling => 'logging.streaming.assembling',
      _ => 'logging.streaming.analyzing',
    };

/// Live preview while the SSE analysis streams: completed items, then names
/// still awaiting macros (the waterfall). Ported 1:1 from
/// `apps/mobile/src/components/logging/feed/streaming-entry.tsx`.
class StreamingEntry extends StatefulWidget {
  const StreamingEntry({
    super.key,
    required this.status,
    required this.items,
    required this.completedItems,
    this.isLast = false,
  });

  final StreamStatus status;
  final List<String> items;
  final List<MealItem> completedItems;
  final bool isLast;

  @override
  State<StreamingEntry> createState() => _StreamingEntryState();
}

class _StreamingEntryState extends State<StreamingEntry>
    with TickerProviderStateMixin {
  // Continuous 360° spin (CSS animate-spin equivalent), 1000ms linear.
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat();

  // Pulse 0.5 → 1 → 0.5 for skeleton bars / the timeline dot, 2000ms.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2000),
  )..repeat(reverse: true);
  // Tailwind animate-pulse: opacity 1→.5→1 over 2s cubic-bezier(0.4,0,0.6,1).
  late final Animation<double> _pulseOpacity = Tween<double>(
    begin: 0.5,
    end: 1,
  ).animate(
    CurvedAnimation(parent: _pulse, curve: const Cubic(0.4, 0, 0.6, 1)),
  );

  // A gentle reassurance line appears once the run passes ~20s, so a slow
  // pipeline doesn't read as a stall.
  bool _showReassurance = false;
  late final Timer _reassuranceTimer = Timer(
    const Duration(seconds: 20),
    () {
      if (mounted) setState(() => _showReassurance = true);
    },
  );

  @override
  void initState() {
    super.initState();
    _reassuranceTimer; // start the timer
  }

  @override
  void dispose() {
    _reassuranceTimer.cancel();
    _spin.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final completedNames =
        widget.completedItems.map((i) => i.name.toLowerCase()).toSet();
    final pendingNames = widget.items
        .where((n) => !completedNames.contains(n.toLowerCase()))
        .toList();
    final phaseLabel = _phaseKeys.contains(widget.status)
        ? _phaseKey(widget.status).tr()
        : 'logging.streaming.analyzing'.tr();

    // Anonymous skeleton rows pad the list up to DEFAULT_SKELETON_COUNT=3 while
    // the phase is still early (streaming-meal-entry.tsx:72-75).
    const defaultSkeletonCount = 3;
    final totalKnown = widget.completedItems.length + pendingNames.length;
    final anonymousCount = (defaultSkeletonCount - totalKnown).clamp(0, 3);
    final showAnonymous = widget.status != StreamStatus.assembling &&
        widget.status != StreamStatus.done;

    return TimelineRail(
      isLast: widget.isLast,
      dotChild: FadeTransition(
        opacity: _pulseOpacity,
        child: const _StreamingDot(),
      ),
      child: Padding(
        padding: const EdgeInsets.only(bottom: NhamSpacing.sp3), // mb-3
        child: _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Items block — mb-4 with 4px row gaps.
              Padding(
                padding: const EdgeInsets.only(bottom: NhamSpacing.sp4),
                child: Column(
                  children: [
                    for (var i = 0; i < widget.completedItems.length; i++)
                      FadeInLeft(
                        key: ValueKey(widget.completedItems[i].id),
                        offset: 8,
                        delay: Duration(milliseconds: i * 40),
                        child: _CompletedRow(item: widget.completedItems[i]),
                      ),
                    for (var i = 0; i < pendingNames.length; i++)
                      FadeInLeft(
                        key: ValueKey('${pendingNames[i]}-$i'),
                        offset: 8,
                        delay: Duration(
                            milliseconds:
                                (widget.completedItems.length + i) * 80),
                        child: _PendingRow(
                          name: pendingNames[i],
                          pulse: _pulseOpacity,
                        ),
                      ),
                    if (showAnonymous)
                      for (var i = 0; i < anonymousCount; i++)
                        FadeInLeft(
                          key: ValueKey('skel-$i'),
                          offset: 8,
                          delay: Duration(
                              milliseconds: (totalKnown + i) * 80),
                          child: _AnonymousRow(
                            // name-bar width 80 + index*20px.
                            nameWidth: 80 + (totalKnown + i) * 20,
                            pulse: _pulseOpacity,
                          ),
                        ),
                  ],
                ),
              ),

              // Totals skeleton.
              const DashedDivider(color: NhamColors.borderHalf),
              const SizedBox(height: NhamSpacing.sp3), // pt-3
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  NhamText(
                    'logging.mealEntry.total'.tr(),
                    variant: NhamTextVariant.itemName,
                    style: NhamTextStyles.sansBold(fontSize: NhamFontSize.detail)
                        .copyWith(color: NhamColors.text),
                  ),
                  Row(
                    children: [
                      _Skeleton(width: 40, height: 14, pulse: _pulseOpacity),
                      const SizedBox(width: NhamSpacing.sp2),
                      _Skeleton(width: 40, height: 14, pulse: _pulseOpacity),
                      const SizedBox(width: NhamSpacing.sp2),
                      _Skeleton(width: 40, height: 14, pulse: _pulseOpacity),
                      const SizedBox(width: NhamSpacing.sp4), // gap-4
                      _Skeleton(
                        width: 56,
                        height: 16,
                        pulse: _pulseOpacity,
                        strong: true,
                      ),
                    ],
                  ),
                ],
              ),

              // Stage indicator — spinner + phase label.
              const SizedBox(height: NhamSpacing.sp3), // mt-3
              Row(
                children: [
                  RotationTransition(turns: _spin, child: const _Spinner()),
                  const SizedBox(width: NhamSpacing.sp2), // gap-2
                  NhamText(phaseLabel, variant: NhamTextVariant.phaseLabel),
                ],
              ),
              // ~20s reassurance line — appears when the pipeline runs long.
              if (_showReassurance) ...[
                const SizedBox(height: NhamSpacing.sp2),
                NhamText(
                  'logging.streaming.stillWorking'.tr(),
                  variant: NhamTextVariant.small,
                  style: const TextStyle(color: NhamColors.textMuted),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CompletedRow extends StatelessWidget {
  const _CompletedRow({required this.item});
  final MealItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10), // py-2.5
      child: Row(
        children: [
          Expanded(
            child: NhamText(item.name,
                variant: NhamTextVariant.itemName, maxLines: 1),
          ),
          const SizedBox(width: NhamSpacing.sp3),
          Row(
            children: [
              NhamText('P: ${fmtG(item.macros.protein)}',
                  variant: NhamTextVariant.macroTiny),
              const SizedBox(width: NhamSpacing.sp2),
              NhamText('C: ${fmtG(item.macros.carbs)}',
                  variant: NhamTextVariant.macroTiny),
              const SizedBox(width: NhamSpacing.sp2),
              NhamText('F: ${fmtG(item.macros.fat)}',
                  variant: NhamTextVariant.macroTiny),
              const SizedBox(width: NhamSpacing.sp3), // gap-3
              NhamText(fmtKcal(item.macros.calories),
                  variant: NhamTextVariant.calorieBold),
            ],
          ),
        ],
      ),
    );
  }
}

class _PendingRow extends StatelessWidget {
  const _PendingRow({required this.name, required this.pulse});
  final String name;
  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10), // py-2.5
      child: Row(
        children: [
          Expanded(
            child: NhamText(name,
                variant: NhamTextVariant.itemName, maxLines: 1),
          ),
          const SizedBox(width: NhamSpacing.sp3),
          Row(
            children: [
              _Skeleton(width: 36, height: 12, pulse: pulse),
              const SizedBox(width: NhamSpacing.sp2),
              _Skeleton(width: 36, height: 12, pulse: pulse),
              const SizedBox(width: NhamSpacing.sp2),
              _Skeleton(width: 36, height: 12, pulse: pulse),
              const SizedBox(width: NhamSpacing.sp3), // gap-3
              _Skeleton(width: 48, height: 14, pulse: pulse, strong: true),
            ],
          ),
        ],
      ),
    );
  }
}

/// An anonymous (un-named) skeleton row: a name-placeholder bar instead of a
/// real name, plus the macro/calorie skeleton bars (meal-entry-item-skeleton).
class _AnonymousRow extends StatelessWidget {
  const _AnonymousRow({required this.nameWidth, required this.pulse});
  final double nameWidth;
  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10), // py-2.5
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Name placeholder bar: h-3.5 border/40, width 80+index*20.
          _Skeleton(
            width: nameWidth,
            height: 14,
            pulse: pulse,
            strong: true,
          ),
          const SizedBox(width: NhamSpacing.sp3),
          Row(
            children: [
              _Skeleton(width: 24, height: 12, pulse: pulse), // w-6 border/30
              const SizedBox(width: NhamSpacing.sp2),
              _Skeleton(width: 24, height: 12, pulse: pulse),
              const SizedBox(width: NhamSpacing.sp2),
              _Skeleton(width: 24, height: 12, pulse: pulse),
              const SizedBox(width: NhamSpacing.sp3), // gap-3
              _Skeleton(width: 48, height: 14, pulse: pulse, strong: true),
            ],
          ),
        ],
      ),
    );
  }
}

/// A pulsing skeleton bar. `strong` uses the border/40 fill, else border/30.
class _Skeleton extends StatelessWidget {
  const _Skeleton({
    required this.width,
    required this.height,
    required this.pulse,
    this.strong = false,
  });

  final double width;
  final double height;
  final Animation<double> pulse;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: pulse,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: strong ? NhamColors.borderBiscotti40 : NhamColors.borderFaint,
          borderRadius: BorderRadius.circular(NhamRadii.sm), // rounded-sm
        ),
      ),
    );
  }
}

/// A 12px tan ring with a transparent top, spun continuously by the parent.
class _Spinner extends StatelessWidget {
  const _Spinner();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: const Size(12, 12), painter: _SpinnerPainter());
  }
}

class _SpinnerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.width - 1.5) / 2;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5 // border-[1.5px]
      ..strokeCap = StrokeCap.round
      ..color = NhamColors.accent;
    // ~270° arc (top segment transparent), starting just past 12 o'clock.
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -1.0, // start angle (radians)
      4.9, // ~280° sweep
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(_SpinnerPainter old) => false;
}

/// Card: surface bg, border/60 hairline, rounded-2xl (16px), shadow-sm.
class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.surface, // bg-nham-surface
        borderRadius: BorderRadius.circular(NhamRadii.containerLg), // 16
        border: Border.all(color: NhamColors.borderSoft),
        boxShadow: const [NhamShadows.sm],
      ),
      child: child,
    );
  }
}

/// The streaming timeline dot: h-2 w-2, 2px accent border, accent/30 FILL,
/// animate-pulse (streaming-meal-entry.tsx:93). Differs from the white-fill
/// persisted dot.
class _StreamingDot extends StatelessWidget {
  const _StreamingDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: NhamColors.accent30, // accent @30% fill
        border: Border.all(color: NhamColors.accent, width: 2),
      ),
    );
  }
}
