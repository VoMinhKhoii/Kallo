import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/surface/measured_height.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_mutations.dart';
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
    required this.focusNode,
    required this.onHeightChanged,
    this.scope,
    this.autofocus = false,
    this.onPosted,
    super.key,
  });

  final String shareId;

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
    // Built once. The insets the dock owes are read in [_DockInsets] below,
    // so the keyboard's ~250ms ramp rebuilds one padding and not the field,
    // its decoration and the send affordance on every frame of it.
    return ColoredBox(
      // Opaque: the replies scroll UNDER this dock, and a translucent bar
      // would show them sliding through the field. Outside the insets, so it
      // also fills the home-indicator strip beneath the field.
      color: kPage,
      child: _DockInsets(
        // Measured INSIDE the insets, so the height reported up is the dock's
        // OWN; the body adds the same insets itself, in the same frame. The
        // field grows a line under the user's thumb without re-running this
        // build (the draft only rebuilds the send affordance below) — the
        // measurement catches that on its own.
        child: MeasuredHeight(
          onChanged: widget.onHeightChanged,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: KalloSpacing.sp3,
              vertical: KalloSpacing.sp2,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('reply-composer'),
                    controller: _controller,
                    focusNode: widget.focusNode,
                    // `readOnly`, not `enabled: false`: disabling the field
                    // drops its focus, which collapses the keyboard on every
                    // send and makes a second reply a two-tap affair.
                    readOnly: _submitting,
                    style: dashBody(),
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _submit(),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: tr('groups.feed.replyPlaceholder'),
                      hintStyle: dashBody(color: kInkMuted),
                    ),
                  ),
                ),
                // Only the send affordance listens to the draft: a
                // controller listener would rebuild the whole dock — field
                // included — on every keystroke.
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

/// The two insets the dock owes — the keyboard's and the home indicator's —
/// read in one leaf so their ramp rebuilds one padding.
///
/// A plain Padding, never an AnimatedPadding: iOS ramps `viewInsets` itself
/// over the keyboard's own curve, and animating on top of that lands the dock
/// a frame behind the keyboard the whole way up (see
/// `features/logging/widgets/composer/composer_dock.dart`). The home
/// indicator is already netted against the keyboard by the framework, so
/// paying both is correct rather than double-counting.
class _DockInsets extends StatelessWidget {
  const _DockInsets({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom:
            MediaQuery.viewInsetsOf(context).bottom +
            MediaQuery.paddingOf(context).bottom,
      ),
      child: child,
    );
  }
}
