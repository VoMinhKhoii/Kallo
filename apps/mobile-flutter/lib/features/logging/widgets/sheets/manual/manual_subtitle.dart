import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../logic/manual/manual_display.dart';

/// The line under a food's name in both manual sheets: the state (or brand)
/// in ink, then " · " and the rest muted — "Raw · Skinless chicken breast".
///
/// One [Text.rich], not a row of two texts, so a long English name wraps
/// under its own first line (the continuation starts at the subtitle's left
/// edge, not under the English name) and the two lines share one clamp.
class ManualSubtitle extends StatelessWidget {
  const ManualSubtitle({super.key, required this.subtitle, this.maxLines = 2});

  final ManualSubtitleText subtitle;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final (:lead, :rest) = subtitle;
    return Text.rich(
      TextSpan(
        children: [
          if (lead != null) TextSpan(text: lead, style: dashMeta(color: kInk)),
          if (lead != null && rest != null) const TextSpan(text: ' · '),
          if (rest != null) TextSpan(text: rest),
        ],
      ),
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      style: dashMeta(),
    );
  }
}

/// "Raw" / "Cooked" (capitalised — it leads its line), translated.
String manualStateWord(String state) =>
    (state == 'cooked'
            ? 'logging.manualLogging.stateCooked'
            : 'logging.manualLogging.stateRaw')
        .tr();
