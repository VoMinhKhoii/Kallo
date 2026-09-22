import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import 'thread_composer_avatar.dart';
import 'thread_send_button.dart';

/// The viewer's disc is inset this far from the pill's left edge. The send
/// button's own 6pt of slack around its 32pt disc mirrors it on the right,
/// which is why the pill carries no padding on that side.
const double _inset = 6;

/// One full-width capsule holding the whole act of replying: the viewer's face,
/// the field, and the send button (2026-09-22).
///
/// It was three things in a row before — a bare disc, a theme-decorated field
/// pill, and the word "Trả lời" out beyond it. The disc read as a person
/// standing next to a form rather than as the author of what was being typed,
/// and the label as a second placeholder. Everything that belongs to writing a
/// reply is now inside one shell, which is the anatomy every comment composer
/// the user pointed at uses (Threads, Facebook, iOS Messages).
///
/// The pill paints the box, so the field must not. The app theme sets
/// `filled: true` and an [OutlineInputBorder] on four border slots; clearing
/// only `border` leaves the field drawing its own box INSIDE this one — the
/// nested-card look `DESIGN_SYSTEM.md` warns about. All four, plus
/// `filled: false` and an explicit `contentPadding`, are cleared below.
///
/// Its own file: `thread_composer.dart` sits at the 200-line cap for
/// `lib/**/widgets/**`, and the split falls where the seam already was — the
/// composer owns the dock, the draft and the mutation, and this owns the shape.
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

  /// A reply is in flight: the field goes read-only and the send button spins.
  final bool submitting;

  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      // The disc and the button pin to the field's LAST line, so both stay on
      // the first line of a one-line draft and travel down with a grown one
      // rather than floating in the middle of four lines.
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const SizedBox(width: _inset),
        // The 44pt box is the send button's tap target height, which is what
        // sets the pill's own minimum: matching it here centres the 28pt disc
        // on the same line the glyph sits on.
        const SizedBox(
          height: KalloIcons.hit,
          child: Center(child: ThreadComposerAvatar()),
        ),
        const SizedBox(width: KalloSpacing.sp2),
        Expanded(
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
              // 11 vertical against a 16/1.3 line (~21pt) lands one line at 43,
              // just inside the pill's 44 — so an empty composer is a capsule
              // and the second line is what grows it. The right inset is the
              // field's own: the send button is absent at rest, and text that
              // ran to the pill's edge would have nothing holding it off.
              contentPadding: const EdgeInsets.only(
                top: 11,
                bottom: 11,
                right: KalloSpacing.sp3,
              ),
            ),
          ),
        ),
        ThreadSendButton(
          controller: controller,
          submitting: submitting,
          onSubmit: onSubmit,
        ),
      ],
    );
    // Only the shell listens to focus, with [row] handed down as `child`:
    // focusing the field must not rebuild the field.
    return ListenableBuilder(
      listenable: focusNode,
      child: row,
      builder: (context, child) {
        final focused = focusNode.hasFocus;
        return AnimatedContainer(
          // The app's "a control changing shape" duration — the same one the
          // send button morphs on, so a tap into the field and the keystroke
          // after it read as one control settling.
          duration: KalloMotion.emphasis,
          curve: KalloEase.standard,
          constraints: const BoxConstraints(minHeight: KalloIcons.hit),
          decoration: BoxDecoration(
            color: kFieldFill,
            // 26 is the app's input radius; at 44 tall it clamps to a capsule
            // and at four lines it is the same full-round field every other
            // surface uses.
            borderRadius: BorderRadius.circular(KalloRadii.input),
            // The focus ring the app theme used to paint on the field itself
            // (`kallo_theme.dart`, `focusedBorder`), moved out to the shell
            // with the rest of the box.
            border: Border.all(
              color: focused ? KalloColors.accent40 : KalloColors.border,
              width: focused ? 2 : 1,
            ),
          ),
          child: child,
        );
      },
    );
  }
}
