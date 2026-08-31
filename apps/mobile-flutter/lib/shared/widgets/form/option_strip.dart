import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'option_strip_segment.dart';
import 'segmented_strip.dart';

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

/// Which skin to draw.
///
/// [segmented] is the native-pass skin and **the default for new work**: a
/// 36pt track on a 44pt tap target, 14pt labels, a sliding white thumb — the
/// iOS segmented control the whole app's chips and range pickers are cut to.
///
/// [onboarding] and [settings] are the two legacy skins. Onboarding and
/// settings each carried their own copy of this control and the copies drifted
/// in half a dozen small, unrelated ways; both are still on screen (the
/// onboarding wizard, the cooking-preferences screens, the cheat-intensity
/// row) and both draw multi-line options with hint sub-labels, which the
/// segmented skin has no room for — so they are kept until those surfaces are
/// ported. [OptionStripSkinSpec] lists what differs between them.
enum OptionStripSkin { segmented, onboarding, settings }

/// A segmented control with equal-width buttons.
class OptionStrip extends StatelessWidget {
  /// The native segmented control (native pass, 2026-08-31) — 36pt visual on a
  /// 44pt target, 14pt labels, white thumb sliding under the active segment.
  /// Prefer this one.
  const OptionStrip.segmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
  }) : skin = OptionStripSkin.segmented;

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

  /// The selected option's value. A value matching no option leaves every
  /// segment inactive and (on [OptionStripSkin.segmented]) hides the thumb
  /// rather than sliding it off the end of the track.
  final String value;
  final ValueChanged<String> onChange;
  final OptionStripSkin skin;

  @override
  Widget build(BuildContext context) {
    if (skin == OptionStripSkin.segmented) {
      return SegmentedStrip(
        options: options,
        activeIndex: options.indexWhere((o) => o.value == value),
        onChange: onChange,
      );
    }

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
