import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// The user's meal, as a sent chat message.
///
/// Mounted the instant they hit send and kept on screen through the reveal, so
/// the analysis reads as a reply to something they said. That persistence is
/// why the reveal card is handed an empty `rawInput` — its own Lora quote would
/// otherwise print the same sentence a second line below this one.
///
/// Umber (`KalloColors.btn`), not the tan accent: this bubble carries running
/// text, and the palette rule is that tan "survives only on non-text moments"
/// and never colours running text. Tan would also fail contrast against white
/// (2.1:1); umber clears AA at 5.9:1.
class UserMessageBubble extends StatelessWidget {
  const UserMessageBubble({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.85,
        alignment: Alignment.centerRight,
        child: Align(
          alignment: Alignment.centerRight,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: KalloSpacing.sp3_5, // 14
              vertical: KalloSpacing.sp2_5, // 10
            ),
            decoration: const BoxDecoration(
              color: KalloColors.btn,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(KalloRadii.xxl), // 18
                topRight: Radius.circular(KalloRadii.xxl),
                bottomLeft: Radius.circular(KalloRadii.xxl),
                // The tightened corner that makes it read as sent, not received.
                bottomRight: Radius.circular(KalloRadii.sm), // 6
              ),
            ),
            child: Text(
              text,
              style: dashBody(color: KalloColors.bandForeground),
            ),
          ),
        ),
      ),
    );
  }
}
