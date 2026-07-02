import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/meal.dart';
import '../../../models/streaming.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/format.dart';
import 'entrances.dart';

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

/// The analyzing card while the SSE analysis streams. The items still stream out
/// like the original waterfall — names appear as they're detected, then carry
/// real macros once resolved — but there is a SINGLE loading state: the current
/// step (spinner + phase label) at the bottom. No skeleton placeholder bars.
class StreamingEntry extends StatefulWidget {
  const StreamingEntry({
    super.key,
    required this.status,
    required this.items,
    required this.completedItems,
    this.rawInput,
    this.isLast = false,
  });

  final StreamStatus status;
  final List<String> items;
  final List<MealItem> completedItems;

  /// The user's just-typed text, shown as a Lora quote at the top of the card
  /// the instant the meal is sent — so the card carries their words while it
  /// analyzes (matches the web).
  final String? rawInput;
  final bool isLast;

  @override
  State<StreamingEntry> createState() => _StreamingEntryState();
}

class _StreamingEntryState extends State<StreamingEntry>
    with SingleTickerProviderStateMixin {
  // Continuous 360° spin (CSS animate-spin equivalent), 1000ms linear.
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduced motion: rest the arc instead of spinning.
    if (MediaQuery.disableAnimationsOf(context)) {
      _spin
        ..stop()
        ..value = 0;
    } else if (!_spin.isAnimating) {
      _spin.repeat();
    }
  }

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final completedNames =
        widget.completedItems.map((i) => i.name.toLowerCase()).toSet();
    // Names detected but not yet carrying macros — the streaming waterfall.
    final pendingNames = widget.items
        .where((n) => !completedNames.contains(n.toLowerCase()))
        .toList();

    final phaseLabel = _phaseKeys.contains(widget.status)
        ? _phaseKey(widget.status).tr()
        : 'logging.streaming.analyzing'.tr();

    final hasQuote =
        widget.rawInput != null && widget.rawInput!.trim().isNotEmpty;
    final hasItems =
        widget.completedItems.isNotEmpty || pendingNames.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp3), // mb-3
      child: _Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The typed text as a Lora quote — shown instantly.
            if (hasQuote) ...[
              NhamText(
                widget.rawInput!,
                variant: NhamTextVariant.mealQuote,
                style: const TextStyle(fontSize: 17, height: 28 / 17),
              ),
              const SizedBox(height: NhamSpacing.sp2),
            ],
            // Items stream out: resolved rows first, then detected names.
            if (hasItems) ...[
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
                  child: _PendingNameRow(name: pendingNames[i]),
                ),
              const SizedBox(height: NhamSpacing.sp1),
            ],
            // The ONE loading state: the current step.
            Row(
              children: [
                RotationTransition(turns: _spin, child: const _Spinner()),
                const SizedBox(width: NhamSpacing.sp2), // gap-2
                NhamText(phaseLabel, variant: NhamTextVariant.phaseLabel),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A resolved item: name + real P/C/F + calories.
class _CompletedRow extends StatelessWidget {
  const _CompletedRow({required this.item});
  final MealItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8), // py-2
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

/// A detected-but-unresolved item: just the name, muted (its macros are still
/// streaming). No skeleton bars — the bottom step line is the only loading cue.
class _PendingNameRow extends StatelessWidget {
  const _PendingNameRow({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8), // py-2
      child: NhamText(
        name,
        variant: NhamTextVariant.itemName,
        maxLines: 1,
        style: const TextStyle(color: kInkMuted),
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
