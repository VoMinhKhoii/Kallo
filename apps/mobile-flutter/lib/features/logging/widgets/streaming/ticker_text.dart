import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_typography.dart';
import '../../logic/feed/stream_ticker.dart';

/// One rendered ticker line: either a dish the pipeline just surfaced, or the
/// action verb for the stage it is in.
///
/// Both render at Body 14 so the row never changes height mid-flip.
class TickerText extends StatelessWidget {
  /// A dish, in the meal's own words.
  const TickerText.dish(StreamTickerFrame this.frame, {super.key})
    : verb = null;

  /// What the app is doing right now.
  const TickerText.verb(String this.verb, {super.key}) : frame = null;

  final StreamTickerFrame? frame;
  final String? verb;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      _span(),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }

  TextSpan _span() {
    final verbText = verb;
    if (verbText != null) {
      // Umber, so "working" reads as the app's own voice rather than as data.
      return TextSpan(
        style: dashBody(color: KalloColors.btn, weight: FontWeight.w500),
        text: verbText,
      );
    }

    // The meal's own words, as on web: serif italic in primary ink. NOT
    // KalloTextVariant.italicAccent, which is Lora italic in TAN — the palette
    // rule is that tan never colours running text.
    final words = KalloTextStyles.serifItalic(
      fontSize: 14,
      height: 1.3,
    ).copyWith(color: kInk);

    return switch (frame) {
      MacrosFrame(:final name, :final calories) => TextSpan(
        style: words,
        text: name,
        children: [
          TextSpan(
            // fontStyle back to normal explicitly: a child span merges onto its
            // parent, so the italic above would otherwise leak into the kcal.
            style: dashBody(
              color: kInkMuted,
              tabular: true,
            ).copyWith(fontStyle: FontStyle.normal),
            text: ' · $calories ${'logging.cheatSliders.kcal'.tr()}',
          ),
        ],
      ),
      ItemFrame(:final name) => TextSpan(style: words, text: '$name…'),
      _ => TextSpan(style: words, text: ''),
    };
  }
}
