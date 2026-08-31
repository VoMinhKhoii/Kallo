import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';

/// The app-wide section header row (native pass, 2026-08-31): a mixed-case
/// 17/600 ink title, with an optional 12 muted meta on the right baseline —
/// "Vitamins · Limited data", "Progress · 30 days", "Calories · Average".
///
/// Replaces the retired uppercase eyebrow as the visible section label. Sits
/// on the canvas between cards; the parent stack owns the 12px gaps.
class SectionHeaderRow extends StatelessWidget {
  const SectionHeaderRow({super.key, required this.title, this.meta});

  final String title;

  /// Quiet qualifier on the right ("30 days", "2 logged"). Omit for a bare
  /// header.
  final String? meta;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Expanded(child: Text(title, style: kSectionHeader())),
        if (meta != null) Text(meta!, style: dashMeta()),
      ],
    );
  }
}

/// The 14/500 muted group label above a grouped card ("Targets",
/// "Preferences", "Today") — the quieter tier below [SectionHeaderRow].
class GroupLabel extends StatelessWidget {
  const GroupLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text, style: kGroupLabel());
  }
}
