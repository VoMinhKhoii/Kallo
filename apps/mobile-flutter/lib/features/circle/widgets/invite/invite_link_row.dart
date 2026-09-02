import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/env/env.dart';
import '../../../../services/http/api_client.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../../logic/handle_validation.dart';
import 'invite_controls.dart';

/// Builds the shareable invite URL for [handle] in the current locale.
String inviteLinkFor(BuildContext context, String handle) =>
    '${Env.webBaseUrl}/${context.locale.languageCode}/invite/$handle';

/// The invite link as one 64pt row — pencil to edit its end, copy to take it.
/// The editor validates inline (red issue line, disabled save) like the web
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
      ClipboardData(text: inviteLinkFor(context, widget.profile.handle)),
    );
    if (!mounted) return;
    HapticFeedback.lightImpact(); // the link leaves the app
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
      showTopToast(
        context,
        code == 'CONFLICT'
            ? tr('groups.invite.endTaken')
            : tr('groups.invite.endError'),
        variant: TopToastVariant.error,
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_editing) return _buildEditor();
    return InviteValueRow(
      label: tr('groups.invite.yourLink'),
      value: inviteLinkFor(context, widget.profile.handle),
      actions: [
        InviteGlyphAction(
          icon: LucideIcons.pencil300,
          semanticsLabel: tr('groups.invite.editTitle'),
          onTap: () {
            _controller.text = widget.profile.handle;
            setState(() => _editing = true);
          },
        ),
        InviteGlyphAction(
          icon: LucideIcons.copy300,
          semanticsLabel: tr('groups.invite.copy'),
          onTap: _copy,
        ),
      ],
    );
  }

  Widget _buildEditor() {
    final showIssue = showsHandleIssue(_normalized);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InviteEditorLabel(label: tr('groups.invite.editTitle')),
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
                  style: dashBody(),
                  decoration: const InputDecoration(
                    prefixText: '…/invite/',
                    isDense: true,
                    counterText: '',
                  ),
                ),
              ),
              const SizedBox(width: KalloSpacing.sp2),
              InviteGlyphAction(
                icon: LucideIcons.check300,
                semanticsLabel: tr('groups.invite.save'),
                loading: _saving,
                disabled: !_canSave,
                emphasis: true,
                onTap: _save,
              ),
              InviteGlyphAction(
                icon: LucideIcons.x300,
                semanticsLabel: tr('groups.invite.cancel'),
                onTap: () => setState(() => _editing = false),
              ),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp1),
          // Red on the affordance, not the copy: the issue line is the one
          // place the rule allows red text, because it IS the affordance.
          Text(
            showIssue
                ? tr('groups.invite.endInvalid')
                : tr('groups.invite.editHint'),
            style: dashMeta(
              color: showIssue ? KalloColors.danger : kInkMuted,
            ),
          ),
        ],
      ),
    );
  }
}
