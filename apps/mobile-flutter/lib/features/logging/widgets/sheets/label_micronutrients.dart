import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/label_nutrients.dart';
import 'label_field_chrome.dart';

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
                      color: NhamColors.textMuted,
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
              final itemWidth = (constraints.maxWidth - NhamSpacing.sp3) / 2;
              return Wrap(
                spacing: NhamSpacing.sp3,
                runSpacing: NhamSpacing.sp3,
                children: [
                  for (final definition in widget.definitions)
                    SizedBox(
                      width: itemWidth,
                      child: _MicroField(
                        definition: definition,
                        controller: widget.controllerFor(definition.key),
                        hasError: widget.hasError(definition.key),
                        enabled: widget.enabled,
                        onChanged: (value) =>
                            widget.onChanged(definition.key, value),
                      ),
                    ),
                ],
              );
            },
          ),
      ],
    );
  }
}

class _MicroField extends StatefulWidget {
  const _MicroField({
    required this.definition,
    required this.controller,
    required this.hasError,
    required this.enabled,
    required this.onChanged,
  });

  final LabelNutrientDefinition definition;
  final TextEditingController controller;
  final bool hasError;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  State<_MicroField> createState() => _MicroFieldState();
}

class _MicroFieldState extends State<_MicroField> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'logging.labelScan.nutrients.${widget.definition.labelKey}'.tr(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: dashMeta(),
        ),
        const SizedBox(height: NhamSpacing.sp1),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                enabled: widget.enabled,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                onChanged: widget.onChanged,
                cursorColor: NhamColors.accent,
                style: dashBody(
                  weight: FontWeight.w500,
                  color: widget.hasError ? NhamColors.danger : kInk,
                ),
                decoration: labelFieldDecoration(
                  hintText: '—',
                  hintStyle: dashBody(color: NhamColors.placeholderMuted40),
                ),
              ),
            ),
            const SizedBox(width: 3),
            Text(widget.definition.unit, style: dashMeta()),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp1),
        LabelFieldRule(hasError: widget.hasError, focused: _focus.hasFocus),
      ],
    );
  }
}
