import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/vessel.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/portion/portion_display.dart';

/// A quiet one-line portion assumption under a meal item — a small vessel
/// thumbnail and `≈ {tier label}`, kept visually subordinate to the macros.
/// The whole line is the button that opens the portion picker.
///
/// Ported from `components/logging/feed/meal-entry/portion/portion-assumption-line.tsx`.
class PortionAssumptionLine extends StatefulWidget {
  const PortionAssumptionLine({
    super.key,
    required this.vessel,
    required this.grams,
    required this.onTap,
  });

  final ClientVessel vessel;

  /// The item's current grams — decides whether a tier label is honest.
  final int grams;

  final VoidCallback onTap;

  @override
  State<PortionAssumptionLine> createState() => _PortionAssumptionLineState();
}

class _PortionAssumptionLineState extends State<PortionAssumptionLine> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode == 'vi' ? 'vi' : 'en';
    final display = portionDisplayFor(widget.vessel, widget.grams, locale);

    return Semantics(
      button: true,
      excludeSemantics: true,
      label: 'logging.portionPicker.adjust'.tr(
        namedArgs: {'label': display.label},
      ),
      onTap: widget.onTap,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          // 40 is the tap-target floor, not the visual height — the thumbnail
          // is 20 and the label 12, so the row reads as quiet as the web's.
          constraints: const BoxConstraints(minHeight: 40),
          padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp1),
          decoration: BoxDecoration(
            // The line sits on the card's WHITE surface, so the warm select
            // wash still registers here (unlike controls on the canvas).
            color: _pressed ? NhamColors.hover40 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.md),
          ),
          child: Row(
            children: [
              Opacity(
                opacity: 0.8,
                child: Image.asset(
                  display.asset.path,
                  height: 20,
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(width: NhamSpacing.sp1_5), // gap-1.5
              Flexible(
                child: Text(
                  'logging.portionPicker.assumption'.tr(
                    namedArgs: {'label': display.label},
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: dashMeta(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
