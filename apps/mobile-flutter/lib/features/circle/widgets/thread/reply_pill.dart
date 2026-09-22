import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/circle_spacing.dart';
import 'thread_composer_avatar.dart';

/// One capsule holding what you are writing and who is writing it: the viewer's
/// face and the field.
///
/// It was two things in a row before — a bare disc, then a theme-decorated
/// field — and the disc read as a person standing next to a form rather than as
/// the author of what was being typed. The send button's placement beside it,
/// and the morph that follows, are documented where the Row is
/// (`thread_composer.dart`).
///
/// [kReplyDockGap] insets everything by the same step on all four sides. It was
/// 6 on the left against 8 above and below (the disc sat in the send button's
/// 44pt box), which shows on a 28pt disc inside a 44pt capsule: the face read
/// as sitting high in its own hole.
///
/// The pill paints the box, so the field must not. The app theme sets
/// `filled: true` and an [OutlineInputBorder] on four border slots; clearing
/// only `border` leaves the field drawing its own box INSIDE this one — the
/// nested-card look `DESIGN_SYSTEM.md` warns about. All four, plus
/// `filled: false` and an explicit `contentPadding`, are cleared below.
///
/// Its own file rather than the composer's: the composer owns the dock, the
/// draft and the mutation; this owns the shape.
class ReplyPill extends StatelessWidget {
  const ReplyPill({
    required this.controller,
    required this.focusNode,
    required this.hintText,
    required this.submitting,
    required this.onSubmit,
    super.key,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String hintText;

  /// A reply is in flight: the field goes read-only (the button beside it spins).
  final bool submitting;

  /// The keyboard's own send key. The button beside the pill calls the same
  /// thing — a field whose action key says "send" has to send.
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      // The disc pins to the field's LAST line, so it stays on the first line of
      // a one-line draft and travels down with a grown one rather than floating
      // in the middle of four lines.
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const ThreadComposerAvatar(),
        const SizedBox(width: kReplyDockGap),
        Expanded(
          // One line of the field is a couple of points SHORTER than the disc,
          // so clamping the single-line case up to it is what makes the disc
          // set the resting height and keeps its four gaps equal. Padding
          // the field to match instead means hard-coding the rendered line box
          // (16 at leading 1.3 does not measure 20.8 once the strut and the
          // decorator have had their say — that arithmetic was 2.2 out, and it
          // would go out again the day the type scale moves). More than one
          // line grows past the clamp as usual.
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kReplyAvatar),
            child: TextField(
              key: const Key('reply-composer'),
              controller: controller,
              focusNode: focusNode,
              // `readOnly`, not `enabled: false`: disabling the field drops its
              // focus, which collapses the keyboard on every send and makes a
              // second reply a two-tap affair.
              readOnly: submitting,
              style: dashBody(),
              minLines: 1,
              maxLines: 4,
              // Explicit, not inherited: [InputDecorator]'s default alignment
              // depends on whether the decoration carries a label, and this one
              // does not — so a future label would silently move the text to
              // the top of the clamped box.
              textAlignVertical: TextAlignVertical.center,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSubmit(),
              decoration: InputDecoration(
                isDense: true,
                hintText: hintText,
                hintStyle: dashBody(color: kInkMuted),
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                // Zero: the pill's own padding owns every inset, which is the
                // point of [kReplyDockGap]. Anything here doubles one side.
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        ),
      ],
    );
    // Only the shell listens to focus, with [row] handed down as `child`:
    // focusing the field must not rebuild the field.
    return ListenableBuilder(
      listenable: focusNode,
      child: row,
      builder: (context, child) {
        final stroke = focusNode.hasFocus ? 2.0 : 1.0;
        return AnimatedContainer(
          // The app's "a control changing shape" duration.
          duration: KalloMotion.emphasis,
          curve: KalloEase.standard,
          // The stroke, SUBTRACTED. A [Container] adds `decoration.padding` —
          // for a [BoxDecoration] that is the border's own dimensions — on top
          // of its `padding`, so taking the stroke out of the padding holds the
          // visible inset at [kReplyDockGap] on every side AND pins the pill's
          // outer height while the ring thickens. Without it, focusing grew the
          // pill by a point on each side and shifted the disc with it — and
          // [AnimatedContainer] interpolates padding and decoration over the
          // same duration and curve, so the sum holds for every frame of the
          // transition, not just at its ends.
          padding: EdgeInsets.all(kReplyDockGap - stroke),
          decoration: BoxDecoration(
            color: kFieldFill,
            // The app's input radius; at [kReplyDockHeight] it clamps to a
            // capsule, and at four lines it is the same full-round field every
            // other surface uses.
            borderRadius: BorderRadius.circular(KalloRadii.input),
            // The focus ring the app theme used to paint on the field itself
            // (`kallo_theme.dart`, `focusedBorder`), moved out to the shell
            // with the rest of the box.
            border: Border.all(
              color: focusNode.hasFocus ? KalloColors.accent40 : kHairline,
              width: stroke,
            ),
          ),
          child: child,
        );
      },
    );
  }
}
