import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/surface/kallo_pressable.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/circle_spacing.dart';

/// The reply dock's send affordance — the arrow-up beside the pill. Its
/// placement, and the morph it drives, are documented at the Row
/// (`thread_composer.dart`).
///
/// It was a text label ("Trả lời") beside the field: a verb in running type
/// there reads as a second placeholder. The glyph and the beige disc are the
/// logging composer's send button
/// (`features/logging/widgets/composer/meal_input_controls.dart`), rebuilt
/// rather than imported — cross-feature imports are out (AGENTS.md §3), and
/// the two differ where it matters: the logging button is always on screen, so
/// it has an unarmed grey state and a stop mode, while this one is simply
/// absent until it has something to send.
///
/// Its own file because it is the one part of the dock that redraws as the user
/// types: it listens to the controller ITSELF rather than making the composer
/// rebuild the field, its decoration and the pill on every keystroke. Even then
/// the button is built once and handed to the listener as its `child` — a
/// keystroke decides only how much of it shows.
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
      // The action goes on the ANNOTATED node, and `excludeSemantics` is
      // exactly why: it drops the [KalloPressable]'s own tap action, so
      // without this the node a screen reader announces as "Send, button" is
      // one a double-tap cannot fire. `feed_entry.dart` documents fixing this
      // same defect on its post row in 2026-09-08 — VoiceOver reading a button
      // it could not activate — and this button reintroduced it.
      //
      // ONE callback behind both the annotation and the target, null on both
      // while submitting, so what the screen reader can do never diverges from
      // what the finger can.
      onTap: submitting ? null : onSubmit,
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
          // `null` while submitting, which is [KalloPressable]'s own disabled
          // contract: it claims the pointer up the chain BEFORE it checks
          // `enabled`, so the tap is swallowed rather than falling through to
          // the field behind it, and no wash paints. An inert `() {}` was
          // strictly worse — it reports the target as enabled, so the disc
          // washed under the finger while a reply was in flight, contradicting
          // the `enabled: !submitting` two lines up.
          onTap: submitting ? null : onSubmit,
          height: kReplyDockHeight,
          constraints: const BoxConstraints(minWidth: kReplyDockHeight),
          alignment: Alignment.center,
          child: Container(
            width: kReplyDockHeight,
            height: kReplyDockHeight,
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
                      // `radius * 2` is the indicator's own box, so this puts
                      // the spinner in the glyph's exact footprint.
                      radius: KalloIcons.action / 2,
                      color: KalloColors.text,
                    )
                    : const Icon(
                      LucideIcons.arrowUp400,
                      // `action`: a glyph acting ON something, one tier under
                      // the navigation 24 — at `primary` it filled too much of
                      // the disc and the button out-weighed the field it sends.
                      // (It was `tertiary` 18 back when the disc was 32.)
                      size: KalloIcons.action,
                      color: KalloColors.text,
                    ),
          ),
        ),
      ),
    );
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      // The same step the pill insets its own disc by, so field-to-button reads
      // as one gap with disc-to-border rather than as a second, wider one. It
      // belongs INSIDE the morph so it collapses with the button: a constant
      // gap on the Row would leave a dead strip between a resting pill and the
      // dock's edge for a button that is not there.
      child: Padding(
        padding: const EdgeInsets.only(left: kReplyDockGap),
        child: button,
      ),
      builder:
          (context, value, child) =>
              _Morph(shown: value.text.trim().isNotEmpty, child: child!),
    );
  }
}

/// The draft appearing is the button appearing, animated as one move.
///
/// Width, opacity and scale together, from a single `t`: width alone reads as a
/// horizontal wipe, and opacity alone pops a full-size disc into a row that has
/// not made room for it yet. [Align]'s `widthFactor` is the shrink-wrap
/// `kallo_pressable.dart` documents — it reports `t` × the child's width to the
/// Row, which is the half of the morph that happens here.
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
