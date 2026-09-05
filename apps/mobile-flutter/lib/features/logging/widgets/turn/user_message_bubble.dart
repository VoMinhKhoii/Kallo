import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/logging_providers.dart';
import 'sent_bubble.dart';

/// The user's meal, as a sent chat message.
///
/// Mounted the instant they hit send and kept on screen through the reveal, so
/// the analysis reads as a reply to something they said. That persistence is
/// why the reveal card is handed an empty `rawInput` — its own Lora quote would
/// otherwise print the same sentence a second line below this one.
///
/// Beige (`KalloColors.btnPrimarySoft`) with INK text — the same wash that
/// marks every in-app primary, a selected choice and the confirm circle, so a
/// sent message reads as "mine" in the app's one warm colour rather than in a
/// colour used nowhere else. It replaced solid umber with white text (native
/// pass, 2026-08-31): a dark block was the heaviest thing on a page of white
/// cards, and the umber tier is now toggles and progress fills only. Ink on
/// #F0EAE0 clears AA at 13:1.
///
/// **Press and hold for Copy and Edit.** What the user typed is the only copy
/// of it — the composer clears on send — so a mis-parsed meal previously had to
/// be retyped from scratch to be re-analysed. Long press is the gesture every
/// chat app uses for this, and on iOS it is what a hard press resolves to.
///
/// Edit is the one that actually answers that: it puts the message back in the
/// composer, focused, for the user to fix and send again. Copy was standing in
/// for it — the clipboard was the only way back to your own words — and stays
/// because pasting them somewhere else is a different job. Edit does NOT
/// re-run the analysis: the whole point is to change the sentence first.
/// It goes through [composerRefillProvider] rather than a drilled callback
/// because this bubble renders in three meal cards and the live turn's footer,
/// none of which can see the composer's controller.
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
/// system menu. The bubble lifts as itself: `CupertinoContextMenu.builder`,
/// not the default `child:` constructor, so the preview keeps our own corners,
/// wrapping and type — [SentBubble] holds the three reasons that matters.
///
/// The action glyphs come from Lucide, the one icon font this app bundles.
/// `CupertinoIcons.doc_on_clipboard` sat here until 2026-09-05 and painted as
/// a tofu box: its font ships in the `cupertino_icons` package, which is not a
/// dependency (nothing but `test/theme/icon_font_test.dart` can catch that —
/// `flutter/cupertino.dart` declares the glyph either way).
class UserMessageBubble extends ConsumerWidget {
  const UserMessageBubble({super.key, required this.text});

  final String text;

  /// Park the message for the composer to pick up — the composer applies it
  /// and says what it displaced ([listenForComposerRefill]).
  void _edit(WidgetRef ref) {
    HapticFeedback.selectionClick();
    ref.read(composerRefillProvider.notifier).state = text;
  }

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    HapticFeedback.selectionClick();
    showTopToast(context, 'logging.messageCopied'.tr());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Align(
      alignment: Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.85,
        alignment: Alignment.centerRight,
        child: Align(
          alignment: Alignment.centerRight,
          // The width the page allows the bubble, read ABOVE the menu so the
          // builder closure carries it into the overlay and the route, where
          // nothing else knows it. [_preview] explains what it buys.
          child: LayoutBuilder(
            builder: (context, page) => Semantics(
              // VoiceOver gets the same actions without the gesture: a long
              // press is invisible to anyone who cannot discover it by
              // holding. Copy has a standard semantic action; Edit does not,
              // so it goes through the custom-action list the rotor reads out.
              onCopy: () => _copy(context),
              customSemanticsActions: {
                CustomSemanticsAction(label: 'logging.edit'.tr()): () =>
                    _edit(ref),
              },
              child: CupertinoContextMenu.builder(
                // The system route fires its own cue as the preview lifts — a
                // beat earlier, and truer to iOS, than one fired on open.
                enableHapticFeedback: true,
                actions: [
                  CupertinoContextMenuAction(
                    trailingIcon: LucideIcons.copy300,
                    onPressed: () async {
                      // Close the route first: the toast is an OverlayEntry
                      // and would otherwise land under the dimming barrier.
                      Navigator.of(context).pop();
                      await _copy(context);
                    },
                    child: Text('logging.copyMessage'.tr()),
                  ),
                  CupertinoContextMenuAction(
                    trailingIcon: LucideIcons.pencil300,
                    onPressed: () {
                      Navigator.of(context).pop();
                      _edit(ref);
                    },
                    child: Text('logging.edit'.tr()),
                  ),
                ],
                builder: (context, animation) => SentBubble(
                  text: text,
                  animation: animation,
                  pageWidth: page.maxWidth,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
