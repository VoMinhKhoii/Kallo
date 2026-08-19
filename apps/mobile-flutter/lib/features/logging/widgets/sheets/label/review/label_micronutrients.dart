import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../../../theme/kallo_theme.dart';
import '../../../../logic/label/nutrients.dart';
import 'label_field.dart';
import 'label_field_label.dart';

/// The optional nutrients the label happened to print, behind a disclosure.
///
/// A rich label carries two dozen of these. Open, they bury the four figures
/// that actually decide the meal under a wall of identical fields; the count on
/// the toggle says they are there without spending the height. Closed is the
/// default because the scan already filled them in — they are for correcting,
/// not for entering.
class LabelMicronutrients extends StatefulWidget {
  const LabelMicronutrients({
    super.key,
    required this.definitions,
    required this.controllerFor,
    required this.hasError,
    required this.onChanged,
    this.enabled = true,
  });

  final List<LabelNutrientDefinition> definitions;
  final TextEditingController Function(String key) controllerFor;
  final bool Function(String key) hasError;
  final void Function(String key, String value) onChanged;
  final bool enabled;

  @override
  State<LabelMicronutrients> createState() => _LabelMicronutrientsState();
}

class _LabelMicronutrientsState extends State<LabelMicronutrients> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          expanded: _open,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _open = !_open);
            },
            child: SizedBox(
              height: 44,
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'logging.labelScan.micronutrients'.tr(
                        namedArgs: {'count': '${widget.definitions.length}'},
                      ),
                      style: dashBody(color: kInkMuted),
                    ),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 160),
                    child: const Icon(
                      LucideIcons.chevronDown300,
                      size: 18,
                      color: KalloColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_open)
          LayoutBuilder(
            builder: (context, constraints) {
              final itemWidth = (constraints.maxWidth - KalloSpacing.sp3) / 2;
              return Wrap(
                spacing: KalloSpacing.sp3,
                runSpacing: KalloSpacing.sp3,
                children: [
                  for (final definition in widget.definitions)
                    SizedBox(width: itemWidth, child: _field(definition)),
                ],
              );
            },
          ),
      ],
    );
  }

  Widget _field(LabelNutrientDefinition definition) => LabelField(
    controller: widget.controllerFor(definition.key),
    textStyle: dashBody(weight: FontWeight.w500),
    hint: '—',
    unit: definition.unit,
    hasError: widget.hasError(definition.key),
    enabled: widget.enabled,
    onChanged: (value) => widget.onChanged(definition.key, value),
    label: LabelFieldLabel(
      text: 'logging.labelScan.nutrients.${definition.labelKey}'.tr(),
    ),
  );
}
