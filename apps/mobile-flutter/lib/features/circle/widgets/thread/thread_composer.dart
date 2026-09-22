import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/surface/measured_height.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_mutations.dart';
import 'reply_pill.dart';
import 'thread_dock_insets.dart';
import 'thread_send_button.dart';

/// The thread page's docked reply composer.
///
/// It replaces the inline underline field that used to open inside a feed
/// card. That field asked the user to hold a conversation in the few points
/// left at the bottom of a post; this one owns the page's bottom edge, which
/// is where every other composer in the app lives.
///
/// Docked, not in the scroll view: the replies scroll under it and the field
/// stays reachable at any scroll offset. Because the body scrolls UNDER it,
/// the dock reports its own laid-out height through [onHeightChanged] — it
/// grows to four lines with the draft, and a constant would leave the last
/// reply stuck behind it (same contract as
/// `features/logging/widgets/composer/composer_dock.dart`).
class ThreadComposer extends ConsumerStatefulWidget {
  const ThreadComposer({
    required this.shareId,
    required this.authorName,
    required this.focusNode,
    required this.onHeightChanged,
    this.scope,
    this.autofocus = false,
    this.onPosted,
    super.key,
  });

  final String shareId;

  /// Who wrote the post being replied to — it names the field's placeholder.
  /// Null on your own post, where the placeholder falls back to "Reply…".
  final String? authorName;

  /// The feed the post was read from — passed to the mutation so the reply
  /// lands in THIS feed's cache even when the Circle tab has another one
  /// selected (a cold deep link selects nothing at all).
  final String? scope;

  /// Owned by the screen, so the post's own reply glyph can focus this field
  /// instead of pushing a second copy of the thread it is already inside.
  final FocusNode focusNode;

  /// Fired (post-frame) whenever the dock's laid-out height changes, so the
  /// body can reserve exactly that much tail.
  final ValueChanged<double> onHeightChanged;

  /// Focuses [focusNode] on this widget's first frame. The screen mounts the
  /// composer only once the thread is readable, so "first frame" already
  /// means "not over a skeleton".
  final bool autofocus;

  /// Fired after a reply lands, so the page can scroll it into view.
  final VoidCallback? onPosted;

  @override
  ConsumerState<ThreadComposer> createState() => _ThreadComposerState();
}

class _ThreadComposerState extends ConsumerState<ThreadComposer> {
  final _controller = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.autofocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.focusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final body = _controller.text.trim();
    if (body.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    try {
      await createShareReply(
        ref,
        shareId: widget.shareId,
        body: body,
        scope: widget.scope,
      );
      if (!mounted) return;
      _controller.clear();
      widget.onPosted?.call();
    } catch (_) {
      if (mounted) {
        showTopToast(
          context,
          tr('groups.feed.replyError'),
          variant: TopToastVariant.error,
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final author = widget.authorName;
    final hint =
        author == null
            ? tr('groups.feed.replyPlaceholder')
            : tr('groups.feed.replyTo', namedArgs: {'name': author});
    // Built once. The insets the dock owes are read in [ThreadDockInsets],
    // so the keyboard's ~250ms ramp rebuilds one padding and not the field,
    // its decoration and the send affordance on every frame of it.
    return ColoredBox(
      // Opaque: the replies scroll UNDER this dock, and a translucent bar
      // would show them sliding through the field. Outside the insets, so it
      // also fills the home-indicator strip beneath the field.
      color: kPage,
      child: ThreadDockInsets(
        // Measured INSIDE the insets, so the height reported up is the dock's
        // OWN; the body adds the same [threadDockInsets] itself, on the same
        // frame. The field grows a line under the thumb without re-running
        // this build — the measurement catches that on its own.
        child: MeasuredHeight(
          onChanged: widget.onHeightChanged,
          child: Padding(
            // No reply rail: the composer is dock CHROME, not a reply in the
            // thread, so the pill spans the page from the dock's own padding.
            // Only the reply ROWS owe that rail (`thread_body.dart`) — leading
            // with it here read as a reply to the last reply.
            padding: const EdgeInsets.symmetric(
              horizontal: KalloSpacing.sp3,
              vertical: KalloSpacing.sp2,
            ),
            // THE DOCK'S ANATOMY, stated here and nowhere else — the two
            // leaves used to tell this story again, each slightly differently.
            //
            // The send button is the pill's SIBLING, not its child: a resting
            // composer is one unbroken capsule across the page, where a button
            // inside it would hold a permanent hole open for something that is
            // usually not there.
            //
            // [Expanded] is what makes that a morph. The button animates its
            // own width from nothing to its disc plus the dock's gap (both
            // named in `logic/circle_spacing.dart`), and the Row re-lays-out on
            // those same frames, so the pill's right end travels left under one
            // motion with nothing on the pill animating at all.
            //
            // `end`, so a draft grown to four lines keeps the disc and the
            // button on its last line rather than centring them beside it.
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: ReplyPill(
                    controller: _controller,
                    focusNode: widget.focusNode,
                    hintText: hint,
                    submitting: _submitting,
                    onSubmit: _submit,
                  ),
                ),
                // Only the send affordance listens to the draft: a controller
                // listener up here would rebuild the field, its decoration and
                // the dock's fill on every keystroke.
                ThreadSendButton(
                  controller: _controller,
                  submitting: _submitting,
                  onSubmit: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
