import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import 'label_field_chrome.dart';

/// The one big number on this sheet: the calories about to be logged.
///
/// The design system reserves Hero (40/500) for a single figure per card, and
/// on a "is this right?" sheet that figure is the calorie count — so it is the
/// readout AND the input, not a boxed field in a stack of four identical ones.
/// It answers "what am I about to log?" before the user reads anything else.
class LabelCalorieHero extends StatefulWidget {
  const LabelCalorieHero({
    super.key,
    required this.controller,
    required this.hasError,
    required this.enabled,
    required this.onChanged,
  });

  final TextEditingController controller;
  final bool hasError;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  State<LabelCalorieHero> createState() => _LabelCalorieHeroState();
}

class _LabelCalorieHeroState extends State<LabelCalorieHero> {
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
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Icon(
              LucideIcons.flame300,
              size: 16,
              color: NhamColors.accent,
            ),
            const SizedBox(width: 6),
            Text(
              'logging.labelScan.nutrients.calories'.tr(),
              style: dashMeta(),
            ),
            Text(' *', style: dashMeta(color: NhamColors.danger)),
          ],
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
                style: dashHero(
                  color: widget.hasError ? NhamColors.danger : kInk,
                ),
                decoration: labelFieldDecoration(
                  hintText: '0',
                  hintStyle: dashHero(color: NhamColors.placeholderMuted40),
                ),
              ),
            ),
            const SizedBox(width: 6),
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text('kcal', style: dashMeta()),
            ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp1),
        LabelFieldRule(hasError: widget.hasError, focused: _focus.hasFocus),
      ],
    );
  }
}
