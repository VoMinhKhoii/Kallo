import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/env/env.dart';
import '../../../../services/http/api_client.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';
import '../../data/circle_providers.dart';
import '../../logic/handle_validation.dart';
import 'invite_controls.dart';

/// The read-only invite link with Copy + inline slug editing. The edit mode
/// validates inline (red issue line, disabled save) like the web
/// `InviteLinkSection`.
class InviteLinkRow extends ConsumerStatefulWidget {
  const InviteLinkRow({super.key, required this.profile});

  final CircleProfile profile;

  @override
  ConsumerState<InviteLinkRow> createState() => _InviteLinkRowState();
}

class _InviteLinkRowState extends ConsumerState<InviteLinkRow> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.profile.handle,
  )..addListener(_onDraftChanged);
  bool _editing = false;
  bool _saving = false;

  String _inviteLink(String handle) =>
      '${Env.webBaseUrl}/${context.locale.languageCode}/invite/$handle';

  String get _normalized => normalizeHandle(_controller.text);

  /// Shape-valid, actually different from the current handle, not mid-save.
  bool get _canSave =>
      isValidHandleShape(_normalized) &&
      _normalized != widget.profile.handle &&
      !_saving;

  void _onDraftChanged() {
    if (_editing) setState(() {});
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _copy() async {
    await Clipboard.setData(
      ClipboardData(text: _inviteLink(widget.profile.handle)),
    );
    if (!mounted) return;
    showTopToast(context, tr('groups.invite.linkCopied'));
  }

  Future<void> _save() async {
    if (!_canSave) return;
    final normalized = _normalized;
    setState(() => _saving = true);
    try {
      await saveCircleProfile(ref, handle: normalized);
      if (!mounted) return;
      setState(() => _editing = false);
      FocusScope.of(context).unfocus();
      showTopToast(context, tr('groups.invite.endSaved'));
    } catch (error) {
      if (!mounted) return;
      final code = error is ApiError ? error.code : null;
      final msg =
          code == 'CONFLICT'
              ? tr('groups.invite.endTaken')
              : tr('groups.invite.endError');
      showTopToast(context, msg, variant: TopToastVariant.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_editing) return _buildEditor();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InviteFieldLabel(
          icon: LucideIcons.link2300,
          label: tr('groups.invite.yourLink'),
        ),
        const SizedBox(height: KalloSpacing.sp1_5),
        Row(
          children: [
            Expanded(
              child: InviteValuePill(
                text: _inviteLink(widget.profile.handle),
                fontSize: KalloFontSize.xs,
                color: KalloColors.textMuted,
              ),
            ),
            const SizedBox(width: KalloSpacing.sp2),
            InviteIconAction(
              icon: LucideIcons.pencil300,
              semanticsLabel: tr('groups.invite.editTitle'),
              onTap: () {
                _controller.text = widget.profile.handle;
                setState(() => _editing = true);
              },
            ),
            const SizedBox(width: KalloSpacing.sp2),
            InviteCopyButton(onTap: _copy),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp1_5),
        Text(
          tr('groups.invite.hint'),
          style: KalloTextStyles.sansRegular(
            fontSize: KalloFontSize.xxs,
          ).copyWith(color: KalloColors.textMuted60),
        ),
      ],
    );
  }

  Widget _buildEditor() {
    final showIssue = showsHandleIssue(_normalized);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InviteFieldLabel(
          icon: LucideIcons.pencil300,
          label: tr('groups.invite.editTitle'),
        ),
        const SizedBox(height: KalloSpacing.sp1_5),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                autofocus: true,
                autocorrect: false,
                enableSuggestions: false,
                textCapitalization: TextCapitalization.none,
                maxLength: kHandleMaxLength,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _save(),
                decoration: const InputDecoration(
                  prefixText: '…/invite/',
                  isDense: true,
                  counterText: '',
                ),
                style: KalloTextStyles.sansRegular(
                  fontSize: KalloFontSize.sm,
                ).copyWith(color: KalloColors.text),
              ),
            ),
            const SizedBox(width: KalloSpacing.sp2),
            InviteIconAction(
              icon: LucideIcons.check300,
              semanticsLabel: tr('groups.invite.save'),
              loading: _saving,
              disabled: !_canSave,
              onTap: _save,
              filled: true,
            ),
            const SizedBox(width: KalloSpacing.sp2),
            InviteIconAction(
              icon: LucideIcons.x300,
              semanticsLabel: tr('groups.invite.cancel'),
              onTap: () => setState(() => _editing = false),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp1_5),
        Text(
          showIssue
              ? tr('groups.invite.endInvalid')
              : tr('groups.invite.editHint'),
          style: KalloTextStyles.sansRegular(
            fontSize: KalloFontSize.xxs,
          ).copyWith(
            color: showIssue ? KalloColors.danger : KalloColors.textMuted,
          ),
        ),
      ],
    );
  }
}
