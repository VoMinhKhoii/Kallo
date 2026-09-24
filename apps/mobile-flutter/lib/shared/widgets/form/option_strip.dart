import 'package:flutter/widgets.dart';

import 'segmented/segmented_strip.dart';

/// A single option for an [OptionStrip] / [SegmentedStrip]: a label and an
/// optional Lucide glyph drawn inline before it.
class OptionStripItem {
  final String value;
  final String label;
  final IconData? icon;
  const OptionStripItem({required this.value, required this.label, this.icon});
}

/// The app's segmented control, addressed by VALUE rather than index — a thin
/// front for [SegmentedStrip] (36pt pill track on a 44pt target, white thumb
/// that pops then travels).
///
/// It used to carry two more skins, `.onboarding` and `.settings`: legacy
/// copies of this control that drew multi-line options with hint sub-labels.
/// Their last callers — the onboarding and Settings cooking screens — moved
/// to [OptionRow]s with the hint as a subline (2026-09-24), and both skins
/// went with them.
class OptionStrip extends StatelessWidget {
  const OptionStrip.segmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChange,
  });

  final List<OptionStripItem> options;

  /// The selected option's value. A value matching no option leaves every
  /// segment inactive and hides the thumb rather than sliding it off the end
  /// of the track.
  final String value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) => SegmentedStrip(
    options: options,
    activeIndex: options.indexWhere((o) => o.value == value),
    onChange: onChange,
  );
}
