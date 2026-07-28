import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../logic/settings_spacing.dart';

/// Flat, Threads-calm settings primitives.
///
/// Hierarchy comes from **type and spacing, not surfaces**: rows sit directly on
/// the page — no cards, no fills at rest — each section headed by a quiet
/// label. Contrast is the two calm text colours: an espresso [kInk] label over
/// a subtle [kInkMuted] current-value subline. Every row shares one icon gutter
/// so the labels line up.
///
/// The individual row primitive lives in `settings_row.dart`.

/// A labelled section: one quiet Meta-12 header above its rows. Rows are spread
/// flat (no wrapping surface) so nothing but the label + spacing groups them.
///
/// The header used to be an 11px ALL-CAPS eyebrow — a fourth type size, and the
/// only shouted text on a screen built to whisper. It is on the calm scale now:
/// [dashMeta] muted, sentence case, so the screen holds exactly three sizes
/// (serif title 22 / row label 14 / meta 12) and hierarchy comes from colour.
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
          padding: const EdgeInsets.only(
            left: NhamSpacing.sp3,
            bottom: SettingsSpacing.label,
          ),
          child: Text(label, style: dashMeta()),
        ),
        ...children,
      ],
    );
  }
}
