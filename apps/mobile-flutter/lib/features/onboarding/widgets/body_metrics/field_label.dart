import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';

/// The uppercase eyebrow that titles every control on the body-metrics step —
/// the web's `font-bold text-[11px] text-kallo-stone uppercase tracking-widest`
/// label, repeated by `about-you-fields.tsx`, `goal-tuning.tsx` and
/// `carb-split-picker.tsx`.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text.toUpperCase(), style: dashEyebrow());
  }
}
