import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../logic/settings_spacing.dart';

/// Flat, Threads-calm settings primitives.
///
/// Hierarchy comes from **type and spacing, not surfaces**: rows sit directly on
/// the page — no cards, no fills at rest — each section headed by a quiet
/// label. Contrast is the two calm text colours: an espresso [kInk] label over
/// a subtle [kInkMuted] current-value subline. Every row shares one icon gutter
/// so the labels line up.
///
/// The individual row primitive lives in `settings_row.dart`.

/// A labelled section: one Meta-12 header in ink above its rows. Rows are
/// spread flat (no wrapping surface) so nothing but the label + spacing groups
/// them.
///
/// The header used to be an 11px ALL-CAPS eyebrow — a fourth type size, and the
/// only shouted text on a screen built to whisper. It is on the calm scale now
/// ([dashMeta], sentence case), so the screen holds exactly three sizes: serif
/// title 22 / row label 14 / meta 12.
///
/// It is **ink, not muted**. Muted put the header in the same colour as the row
/// sublines directly beneath it, so section headings and current-value text
/// were typographically identical and the screen read as one undifferentiated
/// grey column. Muted is now reserved for one job on this screen: a field's
/// current value. Everything structural — headers, labels, glyphs — is ink.
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
          // Left-aligned with each row's icon gutter (the row's own padding),
          // so label and rows share one left edge at the app-wide 12 inset.
          padding: const EdgeInsets.only(
            left: SettingsSpacing.rowPadH,
            bottom: SettingsSpacing.label,
          ),
          child: Text(
            label,
            style: dashMeta(color: kInk, weight: FontWeight.w500),
          ),
        ),
        ...children,
      ],
    );
  }
}
