import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// The beige pill itself, drawn for every state [CupertinoContextMenu] puts it
/// in: at rest in the page, floating in the overlay while the press lifts it,
/// and as the preview above the open actions.
///
/// It is a widget of its own because [UserMessageBubble] hands it to
/// `CupertinoContextMenu.builder` rather than to the default `child:`
/// constructor, and building the preview by hand means owing the three things
/// the default did for us.
///
/// **Our corners, not the menu's.** The default preview builder wraps the child
/// in a `ClipRSuperellipse` at a flat 12. That is squarer than our three round
/// 18s, so it takes nothing from them — but it is rounder than the tightened 4,
/// and softened away the one corner that makes the bubble read as SENT for as
/// long as the menu was open. Nothing clips it here.
///
/// **Wrap where the page wrapped.** A bubble has no width of its own; it takes
/// the row's, and the text wraps inside it. The menu's copies are laid out
/// somewhere else entirely — the lift gets a tight box, the opened preview a
/// loose one as wide as the SCREEN — so a three-line meal re-flowed to a single
/// 760pt line on the way up and was squeezed back down to fit. [pageWidth] is
/// read above the menu and threaded down here; capped at it, the bubble breaks
/// its lines exactly where the user is already looking at them breaking.
///
/// **Zoom, don't grow.** The lift's box is the bubble's own rect scaled ~1.15x
/// and TIGHT — the one signal that separates it from the page, which is always
/// loose. `BoxFit.cover` scales the whole bubble into it, type and all, rather
/// than re-flowing the text 15% wider.
class SentBubble extends StatelessWidget {
  const SentBubble({
    super.key,
    required this.text,
    required this.animation,
    required this.pageWidth,
  });

  final String text;

  /// The menu's open animation, 0 at rest. Drives [_liftShadow] only.
  final Animation<double> animation;

  /// The width the page allows the bubble — see the class doc.
  final double pageWidth;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final bubble = ConstrainedBox(
        constraints: BoxConstraints(maxWidth: pageWidth),
        child: _pill(),
      );
      return constraints.isTight
          ? FittedBox(fit: BoxFit.cover, child: bubble)
          : bubble;
    },
  );

  Widget _pill() => Material(
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
    child: Container(
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp3_5, // 14
        vertical: KalloSpacing.sp2_5, // 10
      ),
      decoration: BoxDecoration(
        color: KalloColors.btnPrimarySoft,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(KalloRadii.xxl), // 18
          topRight: Radius.circular(KalloRadii.xxl),
          bottomLeft: Radius.circular(KalloRadii.xxl),
          // The tightened corner that makes it read as sent — and the whole
          // reason this preview is hand-built.
          bottomRight: Radius.circular(4),
        ),
        boxShadow: _liftShadow(),
      ),
      child: Text(text, style: dashBody()),
    ),
  );

  /// The shadow the bubble grows as the press lifts it off the page — what the
  /// default child animation would have drawn.
  ///
  /// It belongs to the LIFT only: the route draws its preview flat against the
  /// blur, as iOS does. So it fades in across the press (0 →
  /// [CupertinoContextMenu.animationOpensAt]) and is gone from the frame the
  /// route takes over — which is also every frame the page itself is drawn in,
  /// where the bubble has never had a shadow.
  List<BoxShadow>? _liftShadow() {
    final opensAt = CupertinoContextMenu.animationOpensAt;
    final t = animation.value;
    if (t <= 0 || t >= opensAt) return null;
    return BoxShadow.lerpList(
      const <BoxShadow>[],
      CupertinoContextMenu.kEndBoxShadow,
      t / opensAt,
    );
  }
}
