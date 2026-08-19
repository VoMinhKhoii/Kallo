import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'option_strip_segment.dart';

/// A single option for [OptionStrip]: a label, an optional hint sub-label, and
/// an optional leading Lucide icon (web `size-3.5`, currentColor).
class OptionStripItem {
  final String value;
  final String label;
  final String? hint;
  final IconData? icon;
  const OptionStripItem({
    required this.value,
    required this.label,
    this.hint,
    this.icon,
  });
}

/// Which of the two shipped skins to draw. Onboarding and settings each carried
/// their own copy of this control and the copies drifted in half a dozen small,
/// unrelated ways; both are on screen today and neither is documented as the
/// intended one, so both are kept. [OptionStripSkinSpec] lists what differs.
enum OptionStripSkin { onboarding, settings }

/// RN port of web `components/settings/option-strip.tsx` — a segmented control
/// with equal-width buttons. The active segment lifts onto an `elev` chip with
/// the `sm` shadow; an inactive label darkens to ink on press.
class OptionStrip extends StatelessWidget {
  /// The onboarding wizard's skin.
  const OptionStrip.onboarding({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
  }) : skin = OptionStripSkin.onboarding;

  /// The settings skin, also used by the logging cheat-intensity row.
  const OptionStrip.settings({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
  }) : skin = OptionStripSkin.settings;

  final List<OptionStripItem> options;
  final String value;
  final ValueChanged<String> onChange;
  final OptionStripSkin skin;

  @override
  Widget build(BuildContext context) {
    final s = OptionStripSkinSpec.of(skin);
    final row = Row(
      crossAxisAlignment:
          s.stretchToTallest
              ? CrossAxisAlignment.stretch
              : CrossAxisAlignment.center,
      children: [
        for (final opt in options)
          Expanded(
            child: OptionStripSegment(
              item: opt,
              active: value == opt.value,
              onTap: () => onChange(opt.value),
              skin: s,
            ),
          ),
      ],
    );
    return Container(
      padding: const EdgeInsets.all(KalloSpacing.sp1),
      decoration: BoxDecoration(
        color: KalloColors.track,
        borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
      ),
      child: s.stretchToTallest ? IntrinsicHeight(child: row) : row,
    );
  }
}
