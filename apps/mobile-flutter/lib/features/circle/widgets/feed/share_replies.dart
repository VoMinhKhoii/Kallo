import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_mutations.dart';
import 'reply_row.dart';

class ShareReplies extends ConsumerStatefulWidget {
  const ShareReplies({
    required this.shareId,
    required this.replies,
    required this.repliesTotal,
    required this.open,
    required this.onClose,
    super.key,
  });
  final String shareId;
  final List<ShareReply> replies;
  final int repliesTotal;

  /// Whether the composer is showing. Owned by [FeedEntry] because the trigger
  /// now lives in the action row above, not in this widget.
  final bool open;

  /// Called when the composer gives up focus with nothing typed.
  final VoidCallback onClose;
  @override
  ConsumerState<ShareReplies> createState() => _ShareRepliesState();
}

class _ShareRepliesState extends ConsumerState<ShareReplies> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  bool _submitting = false;
  @override
  void initState() {
    super.initState();
    _controller.addListener(_changed);
    _focus.addListener(_focusChanged);
    if (widget.open) _focusComposer();
  }

  @override
  void didUpdateWidget(ShareReplies oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Opened from the action row — take focus so the keyboard comes up on the
    // same tap rather than a second one.
    if (widget.open && !oldWidget.open) _focusComposer();
  }

  void _changed() => setState(() {});
  void _focusChanged() {
    if (!_focus.hasFocus && _controller.text.trim().isEmpty && mounted) {
      widget.onClose();
    }
  }

  void _focusComposer() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus.requestFocus();
    });
  }

  Future<void> _submit() async {
    final body = _controller.text.trim();
    if (body.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    try {
      await createShareReply(ref, shareId: widget.shareId, body: body);
      if (!mounted) return;
      _controller.clear();
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
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final hidden = widget.repliesTotal - widget.replies.length;
    // Nothing to say and nothing to type: draw no box at all, so a post with no
    // replies keeps the action row as its last line.
    if (!widget.open && widget.replies.isEmpty && hidden <= 0) {
      return const SizedBox.shrink();
    }
    // Top gap comes from the action row's tap slack above; this widget owns
    // the post's bottom gap whenever it renders anything.
    return Padding(
      padding: const EdgeInsets.only(bottom: KalloSpacing.sp3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hidden > 0) ...[
            Text(
              tr('groups.feed.earlierReplies', namedArgs: {'count': '$hidden'}),
              style: dashMeta(),
            ),
            const SizedBox(height: KalloSpacing.sp3),
          ],
          for (final reply in widget.replies) ...[
            ReplyRow(reply: reply, locale: locale),
            const SizedBox(height: KalloSpacing.sp3),
          ],
          if (widget.open) _composer(),
        ],
      ),
    );
  }

  Widget _composer() => Row(
    children: [
      Expanded(
        child: Semantics(
          label: tr('groups.feed.replyPlaceholder'),
          textField: true,
          child: TextField(
            key: const Key('reply-composer'),
            controller: _controller,
            focusNode: _focus,
            autofocus: true,
            enabled: !_submitting,
            style: dashBody(),
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => _submit(),
            decoration: InputDecoration(
              isDense: true,
              hintText: tr('groups.feed.replyPlaceholder'),
              hintStyle: dashBody(color: kInkMuted),
              enabledBorder: const UnderlineInputBorder(
                borderSide: BorderSide(color: kHairline),
              ),
              focusedBorder: const UnderlineInputBorder(
                borderSide: BorderSide(color: kInk),
              ),
            ),
          ),
        ),
      ),
      if (_controller.text.trim().isNotEmpty) ...[
        const SizedBox(width: KalloSpacing.sp2),
        TextButton(
          onPressed: _submitting ? null : _submit,
          child: Text(tr('groups.feed.reply'), style: dashMeta(color: kInk)),
        ),
      ],
    ],
  );
}
