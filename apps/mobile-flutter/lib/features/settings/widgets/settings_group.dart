import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';

/// Flat, Threads-calm settings primitives.
///
/// Hierarchy comes from **type and spacing, not surfaces**: rows sit directly on
/// the cream page — no cards, no fills at rest — each section headed by a quiet
/// eyebrow. Contrast is the two calm text colours: an espresso [kInk] label over
/// a subtle [kInkMuted] current-value subline. Every row shares one icon gutter
/// so the labels line up.
///
/// The individual row primitive lives in `settings_row.dart`.

/// An eyebrow-labelled section: a muted ALL-CAPS header above its rows. Rows are
/// spread flat (no wrapping surface) so nothing but the label + spacing groups
/// them.
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({super.key, required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          // Left-aligned with each row's label gutter (row horizontal padding).
          padding: const EdgeInsets.only(left: NhamSpacing.sp3, bottom: 4),
          child: Text(label.toUpperCase(), style: dashEyebrow()),
        ),
        ...children,
      ],
    );
  }
}
