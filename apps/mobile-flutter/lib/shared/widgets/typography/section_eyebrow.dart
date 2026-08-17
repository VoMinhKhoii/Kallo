import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_typography.dart';

/// RN port of `apps/mobile/src/components/shared/section-eyebrow.tsx`.
///
/// Bold 11px stone uppercase with wide ~0.22em tracking (2.4px), an optional
/// `· trailing` middle-dot suffix, and the web's opacity + downward-y entrance
/// fade (Reanimated `FadeInDown.duration(500).delay(delay)`).
class SectionEyebrow extends StatefulWidget {
  const SectionEyebrow({
    super.key,
    required this.label,
    this.trailing,
    this.delay = Duration.zero,
  });

  final String label;

  /// Optional secondary label (e.g. range word). Rendered after a middle dot.
  final String? trailing;

  /// Entrance delay (mirrors the web motion stagger).
  final Duration delay;

  @override
  State<SectionEyebrow> createState() => _SectionEyebrowState();
}

class _SectionEyebrowState extends State<SectionEyebrow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 500),
  );

  late final Animation<double> _opacity = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOut,
  );

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      Future.delayed(widget.delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // Web: text-[11px] tracking-[0.22em] (~2.42px), bold stone, uppercase.
  static final TextStyle _label = KalloTextStyles.sansBold(fontSize: 11)
      .copyWith(letterSpacing: 2.4, color: KalloColors.stone);

  static final TextStyle _dot = KalloTextStyles.sansBold(fontSize: 11)
      .copyWith(letterSpacing: 0, color: KalloColors.border);

  @override
  Widget build(BuildContext context) {
    final trailing = widget.trailing;
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(widget.label.toUpperCase(), style: _label),
        if (trailing != null && trailing.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text('·', style: _dot),
          ),
          Text(trailing.toUpperCase(), style: _label),
        ],
      ],
    );

    return FadeTransition(
      opacity: _opacity,
      // FadeInDown: start ~16px below, settle to 0 as it fades in.
      child: AnimatedBuilder(
        animation: _opacity,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, 16 * (1 - _opacity.value)),
          child: child,
        ),
        child: row,
      ),
    );
  }
}
