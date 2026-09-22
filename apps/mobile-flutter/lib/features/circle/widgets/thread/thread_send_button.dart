import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/surface/kallo_pressable.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';

/// The send disc IS the tap target, and both are the app's one hit target —
/// which is also the resting pill's height beside it (`reply_pill.dart`:
/// the disc plus its two [KalloSpacing.sp2] gaps), so the button stands exactly
/// as tall as the field it sends.
///
/// It was a 32 disc centred in a 44 box. That box's 6pt of slack read as part
/// of the gap, so the space between field and button measured 14 against the
/// 8 inside the pill — two gaps that should be one number. With the disc
/// filling its target there is no slack to read.
const double _disc = KalloIcons.hit;

/// The reply dock's send affordance, BESIDE the pill: nothing at all until
/// there is a draft, then the app's send button opening a space for itself.
///
/// Outside the capsule rather than in it (2026-09-22). Inside, the pill's right
/// end had to hold a permanent 44pt hole for a button that is usually not
/// there; out here a resting composer is one unbroken capsule to the dock's own
/// edge, and the width this widget animates is width the pill gets back — the
/// gap below is inside the animation for the same reason, so the pill reaches
/// the edge rather than stopping 8 short of it.
///
/// It was a text label ("Trả lời") sitting OUTSIDE the field until 2026-09-22.
/// A verb in running type beside a field reads as a second placeholder, and the
/// app already has one send button — the 32pt beige circle with an ink arrow-up
/// on the logging composer. This is that anatomy
/// (`features/logging/widgets/composer/meal_input_controls.dart`), rebuilt here
/// rather than imported: cross-feature imports are out (AGENTS.md §3), and the
/// two differ where it matters — the logging button has an unarmed grey state
/// and a stop mode because it is always on screen, and this one is simply
/// absent until it has something to send.
///
/// Split out of `thread_composer.dart` for the file's 200-line budget, and
/// because it is the one part of the dock that redraws as the user types: it
/// listens to the controller ITSELF rather than making the composer rebuild the
/// field, its decoration and the pill on every keystroke. Even then the button
/// is built once and handed to the listener as its `child` — a keystroke
/// decides only how much of it shows.
class ThreadSendButton extends StatelessWidget {
  const ThreadSendButton({
    required this.controller,
    required this.submitting,
    required this.onSubmit,
    super.key,
  });

  final TextEditingController controller;

  /// Swaps the glyph for a spinner and swallows taps while a reply is in
  /// flight.
  final bool submitting;

  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final button = Semantics(
      // On the node that only exists once there is a draft, not on
      // [ThreadSendButton] itself: at rest this widget renders nothing, and a
      // key on the outer shell would hand a test a zero-sized target to tap.
      key: const Key('reply-send'),
      button: true,
      enabled: !submitting,
      label: tr('groups.feed.replySend'),
      excludeSemantics: true,
      // A TIGHT height, not a minHeight: the dock is laid out in the page's
      // overlay Stack, where the slot is loose and `alignment` makes a
      // min-constrained box take every point offered. The Row's cross axis
      // would become the whole body and the dock's opaque fill would cover
      // every reply the moment a draft existed.
      //
      // [ClipOval] so the press wash follows the disc. [KalloPressable] paints
      // [KalloColors.pressWash] full-bleed — every other consumer is a
      // rectangular row — and a square wash behind a disc that fills its box
      // shows at the four corners. Clipping also narrows hit-testing to the
      // circle, which is what a circular iOS button does anyway.
      child: ClipOval(
        child: KalloPressable(
          // Inert, never null, while submitting: a GestureDetector with only
          // null callbacks registers no recognizer at all, so the target leaves
          // the arena and the tap falls through — here to the field behind it,
          // which would raise the keyboard on a send the user already made.
          onTap: submitting ? () {} : onSubmit,
          height: _disc,
          constraints: const BoxConstraints(minWidth: _disc),
          alignment: Alignment.center,
          child: Container(
            width: _disc,
            height: _disc,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              // The press is carried by [KalloPressable]'s wash over this
              // fill, not by a second one: beige has nowhere lighter to go.
              color: KalloColors.btnPrimarySoft,
              shape: BoxShape.circle,
            ),
            child:
                submitting
                    ? const CupertinoActivityIndicator(
                      // `radius * 2` is the indicator's own box, so this is the
                      // glyph tier below in the same footprint.
                      radius: KalloIcons.primary / 2,
                      color: KalloColors.text,
                    )
                    : const Icon(
                      LucideIcons.arrowUp400,
                      // `primary`: a glyph that carries the whole control,
                      // standing alone at the full height of the row it acts
                      // on. It was `tertiary` 18 when the disc was 32.
                      size: KalloIcons.primary,
                      color: KalloColors.text,
                    ),
          ),
        ),
      ),
    );
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      // [KalloSpacing.sp2], the same step the pill insets its own disc by, so
      // field-to-button reads as one gap with disc-to-border rather than as a
      // second, wider one. It belongs INSIDE the morph so it collapses with
      // the button: a constant gap on the Row would leave a dead strip between
      // a resting pill and the dock's edge for a button that is not there.
      child: Padding(
        padding: const EdgeInsets.only(left: KalloSpacing.sp2),
        child: button,
      ),
      builder:
          (context, value, child) => _Morph(
            shown: value.text.trim().isNotEmpty,
            child: child!,
          ),
    );
  }
}

/// The draft appearing is the button appearing, animated as one move.
///
/// Width, opacity and scale together, from a single `t`: width alone reads as a
/// horizontal wipe, and opacity alone pops a full-size disc into a row that has
/// not made room for it yet. [Align]'s `widthFactor` is the shrink-wrap
/// `kallo_pressable.dart` documents — it reports `t` × the child's width to the
/// Row, and the `Expanded` pill beside it absorbs the difference, which is what
/// makes the capsule shorten and lengthen as one motion with this.
/// `heightFactor: 1` is not optional: an [Align] with no size factor on that
/// axis grows to any finite maximum it is offered, and this one is laid out
/// inside the page's overlay Stack, which offers it the whole body.
///
/// At rest it is `SizedBox.shrink()` rather than a transparent button: nothing
/// paints, and — the part that matters — nothing is in the semantics tree for a
/// screen reader to find a send button that cannot send.
///
/// [KalloMotion.emphasis] is the app's "a control changing shape" duration, and
/// the pill's focus ring runs on it too, so a tap into an empty field and the
/// first keystroke after it read as the same control settling.
class _Morph extends StatelessWidget {
  const _Morph({required this.shown, required this.child});

  final bool shown;
  final Widget child;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween<double>(end: shown ? 1 : 0),
    duration: KalloMotion.emphasis,
    curve: KalloEase.standard,
    child: child,
    builder:
        (context, t, child) =>
            t == 0
                ? const SizedBox.shrink()
                : Align(
                  widthFactor: t,
                  heightFactor: 1,
                  child: Opacity(
                    opacity: t,
                    child: Transform.scale(
                      scale: 0.85 + 0.15 * t,
                      child: child,
                    ),
                  ),
                ),
  );
}
