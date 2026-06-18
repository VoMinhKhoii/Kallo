import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';

const List<String> _ranges = ['7d', '30d', '90d'];

class NutritionRangeSelector extends StatelessWidget {
  const NutritionRangeSelector({
    super.key,
    required this.resolvedRange,
    required this.onRangeChange,
    this.disabled = false,
  });

  final String resolvedRange;
  final ValueChanged<NutritionRangeInput> onRangeChange;
  final bool disabled;

  NutritionRangeInput _inputFor(String range) => switch (range) {
    '7d' => NutritionRangeInput.d7,
    '30d' => NutritionRangeInput.d30,
    '90d' => NutritionRangeInput.d90,
    _ => NutritionRangeInput.auto,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(color: NhamColors.borderSoft),
        color: NhamColors.cardWhite40,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < _ranges.length; i++) ...[
            if (i > 0) const SizedBox(width: 1),
            _RangePill(
              label: tr('nutrition.range.${_ranges[i]}'),
              active: resolvedRange == _ranges[i],
              disabled: disabled,
              onTap: () {
                HapticFeedback.selectionClick();
                onRangeChange(_inputFor(_ranges[i]));
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _RangePill extends StatefulWidget {
  const _RangePill({
    required this.label,
    required this.active,
    required this.disabled,
    required this.onTap,
  });

  final String label;
  final bool active;
  final bool disabled;
  final VoidCallback onTap;

  @override
  State<_RangePill> createState() => _RangePillState();
}

class _RangePillState extends State<_RangePill> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final textColor =
        widget.active
            ? NhamColors.surface
            : _pressed
            ? NhamColors.text
            : NhamColors.textMuted;

    final pill = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(9999),
        color: widget.active ? NhamColors.text : null,
      ),
      child: AnimatedDefaultTextStyle(
        duration: const Duration(milliseconds: 150),
        style: NhamTextStyles.sansMedium(fontSize: 12).copyWith(
          color: textColor,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
        child: Text(widget.label),
      ),
    );

    return Semantics(
      button: true,
      enabled: !widget.disabled,
      selected: widget.active,
      excludeSemantics: true,
      label: widget.label,
      onTap: widget.disabled ? null : widget.onTap,
      child: Opacity(
        opacity: widget.disabled ? 0.6 : 1,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown:
              widget.disabled ? null : (_) => setState(() => _pressed = true),
          onTapUp:
              widget.disabled ? null : (_) => setState(() => _pressed = false),
          onTapCancel:
              widget.disabled ? null : () => setState(() => _pressed = false),
          onTap: widget.disabled ? null : widget.onTap,
          child: SizedBox(height: 44, child: Center(child: pill)),
        ),
      ),
    );
  }
}
