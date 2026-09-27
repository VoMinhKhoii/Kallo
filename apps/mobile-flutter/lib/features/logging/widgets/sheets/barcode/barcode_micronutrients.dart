import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/nutrition/barcode_product.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/barcode_amount.dart';
import '../../../logic/label/nutrients.dart';

/// One nutrient row the disclosure lists: its label-scan definition (label
/// key and unit) and the value scaled to the chosen amount.
typedef _Row = ({LabelNutrientDefinition definition, double value});

/// The label's other nutrients, scaled to the chosen amount, behind the same
/// disclosure the label scan uses. Port of the web's `barcode-micronutrients`.
///
/// Premium: the server sends `micronutrients: null` (and nulls fiber and
/// sodium) to an account without it, and then this renders nothing. The
/// figures are saved with the meal either way.
class BarcodeMicronutrients extends StatefulWidget {
  const BarcodeMicronutrients({
    super.key,
    required this.product,
    required this.grams,
  });

  final BarcodeProduct product;

  /// The chosen amount, in the product's unit.
  final int grams;

  @override
  State<BarcodeMicronutrients> createState() => _BarcodeMicronutrientsState();
}

class _BarcodeMicronutrientsState extends State<BarcodeMicronutrients> {
  bool _open = false;

  /// Per-100 value for a label-scan definition. The label scan names fiber
  /// `fiberGrams`; every other key is spelled the same on both wires.
  double? _perHundred(String key) {
    final product = widget.product;
    return switch (key) {
      'fiberGrams' => product.fiberG,
      'sodiumMg' => product.sodiumMg,
      _ => product.micronutrients?[key],
    };
  }

  List<_Row> _rows() => [
    for (final definition in labelMicronutrientDefinitions)
      if (scalePer100(_perHundred(definition.key), widget.grams)
          case final value?)
        (definition: definition, value: value),
  ];

  String _fmt(double value) =>
      value == value.roundToDouble() ? '${value.round()}' : '$value';

  @override
  Widget build(BuildContext context) {
    if (widget.product.micronutrients == null) return const SizedBox.shrink();
    final rows = _rows();
    if (rows.isEmpty) return const SizedBox.shrink();

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
                        namedArgs: {'count': '${rows.length}'},
                      ),
                      style: dashBody(color: kInkMuted),
                    ),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 160),
                    child: const Icon(
                      LucideIcons.chevronDown300,
                      size: KalloIcons.tertiary,
                      color: KalloColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_open)
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: KalloSpacing.sp1),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'logging.labelScan.nutrients.${row.definition.labelKey}'
                          .tr(),
                      style: dashMeta(),
                    ),
                  ),
                  Text(
                    '${_fmt(row.value)} ${row.definition.unit}',
                    style: dashMeta(color: kInk, tabular: true),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}
