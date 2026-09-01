/// The weight sheet's number entry — the app's full-width field, in kilograms.
///
/// Its own file because it is the one place the app hand-decorates a field
/// instead of reaching for `KalloTextField`, and that deserves to be readable
/// rather than buried in the middle of the sheet's state machine.
///
/// The SHAPE is the shared one and is taken from the shared constants: a 52pt
/// full-round pill ([KalloRadii.input]) on the 18pt inset, so it reads as the
/// same object as every other full-width field in the app (native pass,
/// 2026-08-31; this field was the one it missed, still a 14-radius rounded
/// square on a 48pt box until 2026-09-01).
///
/// What it does NOT share is the decoration, and it cannot: `KalloTextField`
/// pins a white fill, and this field sits on a white bottom sheet, where white
/// on white would erase it. It needs the track fill instead, a danger fill and
/// border while the value is invalid, and a `suffixText` "kg" that sits on the
/// input's own baseline — which the shared field only offers as a suffix
/// WIDGET, floated beside the text rather than set on it.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

class WeightAmountField extends StatelessWidget {
  const WeightAmountField({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.enabled,
    required this.autofocus,
    required this.hasError,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final bool enabled;
  final bool autofocus;

  /// Validation has rejected what is typed — the field takes the danger fill
  /// and keeps its border on, focused or not.
  final bool hasError;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    onChanged: onChanged,
    enabled: enabled,
    autofocus: autofocus,
    keyboardType: const TextInputType.numberWithOptions(decimal: true),
    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
    autocorrect: false,
    cursorColor: KalloColors.accent,
    // Body at medium weight — the surface holds three sizes (Hero / Body /
    // Meta), so a number entry reads as data via weight, not a size of its own.
    style: dashBody(color: kInk, weight: FontWeight.w500, tabular: true),
    decoration: InputDecoration(
      constraints: const BoxConstraints(minHeight: 52),
      filled: true,
      // Track, not the shared field's white: see the library doc above.
      fillColor:
          hasError
              ? KalloColors.danger.withValues(alpha: 0.06)
              : KalloColors.track,
      // 18 is what sets where text starts inside a pill of radius 26 — the
      // shared field's inset, not a step off the spacing scale.
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 18,
        vertical: KalloSpacing.sp3_5,
      ),
      // Suffix in-flow (no Positioned overlay → no overlap).
      suffixText: tr('dashboard.units.kg'),
      suffixStyle: dashMeta(color: kInkMuted),
      border: _border(Colors.transparent),
      enabledBorder: _border(hasError ? KalloColors.danger : Colors.transparent),
      focusedBorder: _border(hasError ? KalloColors.danger : KalloColors.accent),
      disabledBorder: _border(Colors.transparent),
    ),
  );

  /// Border only on focus or error — a filled pill reads as tappable without
  /// one, and a permanent outline over a fill reads as two edges.
  OutlineInputBorder _border(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(KalloRadii.input),
    borderSide: BorderSide(
      color: color,
      width: color == Colors.transparent ? 0 : 1.5,
    ),
  );
}
