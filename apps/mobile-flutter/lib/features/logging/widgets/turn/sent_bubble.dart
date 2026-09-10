import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// The beige pill itself, drawn in both places the message exists: at rest in
/// the page, and — while the long-press menu is open — as the crisp copy the
/// menu pins over its own blur, at exactly the resting rect.
///
/// It is a widget of its own so those two are the same object. Until
/// 2026-09-08 it was a widget of its own for a different reason: it was the
/// preview `CupertinoContextMenu.builder` handed back, and hand-building that
/// preview meant owing the framework three things. Two of them survive, and
/// the third went with the system menu.
///
/// **Our corners, not the menu's.** The default preview builder wrapped the
/// child in a `ClipRSuperellipse` at a flat 12. That is squarer than our three
/// round 18s, so it took nothing from them — but it is rounder than the
/// tightened 4, and softened away the one corner that makes the bubble read as
/// SENT for as long as the menu was open. Nothing clips it here.
///
/// **Wrap where the page wrapped.** A bubble has no width of its own; it takes
/// the row's, and the text wraps inside it. [pageWidth] is read above the menu
/// and threaded down here, so the copy in the overlay breaks its lines exactly
/// where the user is already looking at them breaking. The anchored menu pins
/// this at the resting rect, which makes the constraint a formality — but the
/// cap is what a rect measured off THIS widget is measuring in the first place.
///
/// **Zoom, don't grow** is the one that went. `CupertinoContextMenu` laid the
/// lift out in a TIGHT box 1.15x the bubble's own rect, so the pill had to be
/// scaled into it (`FittedBox`, `BoxFit.cover`) rather than re-flow 15% wider.
/// Nothing scales the bubble now — the whole point of the owned menu is that
/// the message does not move — and the only tight box it ever sees is
/// `Positioned.fromRect` at its own resting size, which it fills exactly.
class SentBubble extends StatelessWidget {
  const SentBubble({super.key, required this.text, required this.pageWidth});

  final String text;

  /// The width the page allows the bubble — see the class doc.
  final double pageWidth;

  @override
  Widget build(BuildContext context) => Material(
    // Transparent, so the bubble looks identical in the page and adds nothing
    // to it. It exists only to carry a real DefaultTextStyle into the overlay
    // and the route, which sit above every Material in the app: what is left
    // up there is `MaterialApp`'s fallback style — debugLabel "consider
    // putting your text in a Material" — and it carries a yellow double
    // underline. [dashBody] merges onto it (`TextStyle.inherit` defaults to
    // true) and overrides colour, size and family but never `decoration`, so
    // the underline survived and painted under the lifted message. Same fix,
    // same reason, as `TopToastPill`.
    type: MaterialType.transparency,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: pageWidth),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp3_5, // 14
          vertical: KalloSpacing.sp2_5, // 10
        ),
        decoration: const BoxDecoration(
          color: KalloColors.btnPrimarySoft,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(KalloRadii.xxl), // 18
            topRight: Radius.circular(KalloRadii.xxl),
            bottomLeft: Radius.circular(KalloRadii.xxl),
            // The tightened corner that makes it read as sent.
            bottomRight: Radius.circular(4),
          ),
        ),
        child: Text(text, style: dashBody()),
      ),
    ),
  );
}
