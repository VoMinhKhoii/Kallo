import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

class OptionStripItem {
  final String value;
  final String label;
  final String? hint;
  const OptionStripItem({required this.value, required this.label, this.hint});
}

/// RN port of `components/settings/controls/option-strip.tsx` — a segmented
/// control with equal-width buttons and an optional hint sub-label. The active
/// segment lifts onto an `elev` chip with the `xs` shadow; press dims to 0.85.
class OptionStrip extends StatelessWidget {
  const OptionStrip({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
  });

  final List<OptionStripItem> options;
  final String value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KalloSpacing.sp1),
      decoration: BoxDecoration(
        color: KalloColors.track,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          for (final opt in options)
            Expanded(
              child: _Segment(
                item: opt,
                active: value == opt.value,
                onTap: () => onChange(opt.value),
              ),
            ),
        ],
      ),
    );
  }
}

class _Segment extends StatefulWidget {
  const _Segment({
    required this.item,
    required this.active,
    required this.onTap,
  });

  final OptionStripItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_Segment> createState() => _SegmentState();
}

class _SegmentState extends State<_Segment> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // active #2C2416, inactive #8B8682; press subtly darkens inactive toward
    // #2C2416 (web has no active: opacity dim — uses hover:text-#2C2416).
    final color = widget.active ? kInk : (_pressed ? kInk : kInkMuted);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        // transition-all (~150ms ease) — active chip bg/shadow animates in.
        duration: const Duration(milliseconds: 150),
        curve: const Cubic(0.25, 0.1, 0.25, 1),
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp2, // px-2
          vertical: KalloSpacing.sp2_5, // py-2.5
        ),
        decoration: widget.active
            ? BoxDecoration(
                color: KalloColors.elev,
                borderRadius: BorderRadius.circular(KalloRadii.md),
                boxShadow: const [KalloShadows.sm], // shadow-sm
              )
            : const BoxDecoration(),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              widget.item.label,
              textAlign: TextAlign.center,
              style: dashBody(color: color, weight: FontWeight.w500),
            ),
            if (widget.item.hint != null)
              Padding(
                padding: const EdgeInsets.only(top: KalloSpacing.sp1), // mt-1
                child: Opacity(
                  opacity: 0.7,
                  child: Text(
                    widget.item.hint!,
                    textAlign: TextAlign.center,
                    maxLines: 2, // line-clamp-2
                    overflow: TextOverflow.ellipsis,
                    style: dashMeta(color: color),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
