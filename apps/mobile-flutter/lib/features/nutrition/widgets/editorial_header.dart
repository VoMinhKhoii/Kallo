import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../models/nutrition.dart';
import '../../../shared/widgets/section_eyebrow.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/format_date.dart';
import 'fade_in_down.dart';

const List<String> _ranges = ['7d', '30d', '90d'];

/// RN port of `apps/mobile/src/components/nutrition/sections/editorial-header.tsx`.
class EditorialHeader extends StatelessWidget {
  const EditorialHeader({
    super.key,
    required this.resolvedRange,
    required this.onRangeChange,
    required this.startDate,
    required this.endDate,
    this.disabled = false,
    this.verdict,
  });

  /// Raw '7d' | '30d' | '90d'.
  final String resolvedRange;
  final ValueChanged<NutritionRangeInput> onRangeChange;
  final String startDate;
  final String endDate;
  final bool disabled;

  /// The verdict line — rendered full-width below the title row on phone.
  final Widget? verdict;

  NutritionRangeInput _inputFor(String range) => switch (range) {
        '7d' => NutritionRangeInput.d7,
        '30d' => NutritionRangeInput.d30,
        '90d' => NutritionRangeInput.d90,
        _ => NutritionRangeInput.auto,
      };

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final dateRange = tr('nutrition.editorial.dateRange', namedArgs: {
      'start': formatDate(startDate, locale),
      'end': formatDate(endDate, locale),
    });

    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: NhamColors.borderHalf)),
      ),
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Title block: web opacity/y:6 duration 0.5 (no delay).
              Flexible(
                child: FadeInDown(
                  offset: 6,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionEyebrow(
                        label: tr('nutrition.editorial.eyebrow'),
                        trailing: tr('nutrition.range.$resolvedRange'),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        dateRange,
                        style: NhamTextStyles.sansRegular(fontSize: 14).copyWith(
                          color: NhamColors.textMuted,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Range toggle: web opacity/y:6 duration 0.5 delay 0.05.
              FadeInDown(
                offset: 6,
                delay: const Duration(milliseconds: 50),
                child: Container(
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
                ),
              ),
            ],
          ),
          if (verdict != null) ...[
            const SizedBox(height: 12),
            // Verdict: web opacity/y:4 duration 0.5 delay 0.1.
            FadeInDown(
              offset: 4,
              delay: const Duration(milliseconds: 100),
              child: SizedBox(width: double.infinity, child: verdict),
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
    // Inactive pills: web `text-nham-text-muted hover:text-nham-text
    // transition-colors` — the touch affordance shifts the text toward
    // nham-text on press-down.
    final textColor = widget.active
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

    return Opacity(
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
        child: pill,
      ),
    );
  }
}
