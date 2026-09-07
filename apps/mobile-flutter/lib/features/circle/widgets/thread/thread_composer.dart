import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_mutations.dart';

/// The thread page's docked reply composer.
///
/// It replaces the inline underline field that used to open inside a feed
/// card. That field asked the user to hold a conversation in the few points
/// left at the bottom of a post; this one owns the page's bottom edge, which
/// is where every other composer in the app lives.
///
/// Docked, not in the scroll view: the replies scroll under it and the field
/// stays reachable at any scroll offset.
class ThreadComposer extends ConsumerStatefulWidget {
  const ThreadComposer({
    required this.shareId,
    required this.focusNode,
    this.onPosted,
    super.key,
  });

  final String shareId;

  /// Owned by the screen, so the post's own reply glyph can focus this field
  /// instead of pushing a second copy of the thread it is already inside.
  final FocusNode focusNode;

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
    // Redraws the send affordance as the field crosses empty/non-empty.
    _controller.addListener(_changed);
  }

  void _changed() => setState(() {});

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
      await createShareReply(ref, shareId: widget.shareId, body: body);
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
    final hasDraft = _controller.text.trim().isNotEmpty;
    // A plain Padding, never an AnimatedPadding: iOS ramps `viewInsets` itself
    // over the keyboard's own curve, and animating on top of that lands the
    // dock a frame behind the keyboard the whole way up (see
    // `features/logging/widgets/composer/composer_dock.dart`).
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    // Already netted against the keyboard by the framework, so paying both is
    // correct rather than double-counting.
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: ColoredBox(
        // Opaque: the replies scroll UNDER this dock, and a translucent bar
        // would show them sliding through the field.
        color: kPage,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            KalloSpacing.sp3,
            KalloSpacing.sp2,
            KalloSpacing.sp3,
            bottomInset + KalloSpacing.sp2,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Semantics(
                  label: tr('groups.feed.replyPlaceholder'),
                  textField: true,
                  child: TextField(
                    key: const Key('reply-composer'),
                    controller: _controller,
                    focusNode: widget.focusNode,
                    enabled: !_submitting,
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
              ),
              if (hasDraft) ...[
                const SizedBox(width: KalloSpacing.sp2),
                Semantics(
                  button: true,
                  enabled: !_submitting,
                  label: tr('groups.feed.reply'),
                  excludeSemantics: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _submitting ? null : _submit,
                    child: Container(
                      constraints: const BoxConstraints(
                        minHeight: KalloIcons.hit,
                        minWidth: KalloIcons.hit,
                      ),
                      alignment: Alignment.center,
                      child: Text(tr('groups.feed.reply'), style: dashBody()),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
