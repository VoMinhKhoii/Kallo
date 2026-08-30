import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../../../../shared/widgets/toast/top_toast.dart';
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
///
/// **Press and hold to copy.** What the user typed is the only copy of it — the
/// composer clears on send — so a mis-parsed meal previously had to be retyped
/// from scratch to be re-analysed. Long press is the gesture every chat app
/// uses for this, and on iOS it is what a hard press resolves to.
///
/// The menu is [CupertinoContextMenu], not Material's `showMenu`. `showMenu`
/// dropped a flat card ON TOP of the bubble with no backdrop, no lift and no
/// entrance — next to the system menu every other chat app gets for free, it
/// read as unfinished. The Cupertino route blurs the page behind it, dims it,
/// floats the bubble above the blur at 1.15x and slides the actions in
/// beneath, which is the whole reason to prefer it over anything hand-rolled.
///
/// Two consequences worth knowing: the hold is 800ms (iOS's own
/// `_previewLongPressTimeout`, not Material's 500), and the action rows carry
/// Cupertino's chrome rather than Be Vietnam Pro — the accepted cost of the
/// system menu. The bubble keeps its own decoration, so the tightened
/// bottom-right corner survives into the lifted preview.
class UserMessageBubble extends StatelessWidget {
  const UserMessageBubble({super.key, required this.text});

  final String text;

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    HapticFeedback.selectionClick();
    showTopToast(context, 'logging.messageCopied'.tr());
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.85,
        alignment: Alignment.centerRight,
        child: Align(
          alignment: Alignment.centerRight,
          child: Semantics(
            // VoiceOver gets the same action without the gesture: a long press
            // is invisible to anyone who cannot discover it by holding.
            onCopy: () => _copy(context),
            child: CupertinoContextMenu(
              // The system route fires its own cue as the preview lifts — a
              // beat earlier, and truer to iOS, than one fired on open.
              enableHapticFeedback: true,
              actions: [
                CupertinoContextMenuAction(
                  trailingIcon: CupertinoIcons.doc_on_clipboard,
                  onPressed: () {
                    // Close the route first: the toast is an OverlayEntry and
                    // would otherwise land under the dimming barrier.
                    Navigator.of(context).pop();
                    unawaited(_copy(context));
                  },
                  child: Text('logging.copyMessage'.tr()),
                ),
              ],
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
                    // The tightened corner that makes it read as sent.
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
        ),
      ),
    );
  }
}
