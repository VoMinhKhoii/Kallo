import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/circle.dart';
import '../../../shared/widgets/profile_avatar.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../data/feed_mutations.dart';
import '../data/feed_time.dart';

class ShareReplies extends ConsumerStatefulWidget {
  const ShareReplies({
    required this.shareId,
    required this.replies,
    required this.repliesTotal,
    super.key,
  });
  final String shareId;
  final List<ShareReply> replies;
  final int repliesTotal;
  @override
  ConsumerState<ShareReplies> createState() => _ShareRepliesState();
}

class _ShareRepliesState extends ConsumerState<ShareReplies> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  bool _open = false;
  bool _submitting = false;
  @override
  void initState() {
    super.initState();
    _controller.addListener(_changed);
    _focus.addListener(_focusChanged);
  }

  void _changed() => setState(() {});
  void _focusChanged() {
    if (!_focus.hasFocus && _controller.text.trim().isEmpty && mounted) {
      setState(() => _open = false);
    }
  }

  void _showComposer() {
    setState(() => _open = true);
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
    return Padding(
      padding: const EdgeInsets.only(top: NhamSpacing.sp3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hidden > 0) ...[
            Text(
              tr('groups.feed.earlierReplies', namedArgs: {'count': '$hidden'}),
              style: dashMeta(),
            ),
            const SizedBox(height: NhamSpacing.sp3),
          ],
          for (final reply in widget.replies) ...[
            _ReplyRow(reply: reply, locale: locale),
            const SizedBox(height: NhamSpacing.sp3),
          ],
          if (_open) _composer() else _replyButton(),
        ],
      ),
    );
  }

  Widget _replyButton() => InkWell(
    onTap: _showComposer,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Text(tr('groups.feed.reply'), style: dashMeta()),
    ),
  );

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
        const SizedBox(width: NhamSpacing.sp2),
        TextButton(
          onPressed: _submitting ? null : _submit,
          child: Text(tr('groups.feed.reply'), style: dashMeta(color: kInk)),
        ),
      ],
    ],
  );
}

class _ReplyRow extends StatelessWidget {
  const _ReplyRow({required this.reply, required this.locale});

  final ShareReply reply;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final name = reply.isSelf ? tr('groups.wall.you') : reply.author.label;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileAvatarDisc(profile: reply.author, size: 28),
        const SizedBox(width: NhamSpacing.sp2),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: name,
                      style: dashBody(weight: FontWeight.w500),
                    ),
                    TextSpan(
                      text:
                          '  ${formatElapsed(reply.createdAt, locale: locale)}',
                      style: dashMeta(),
                    ),
                  ],
                ),
              ),
              Text(reply.body, style: dashBody()),
            ],
          ),
        ),
      ],
    );
  }
}
