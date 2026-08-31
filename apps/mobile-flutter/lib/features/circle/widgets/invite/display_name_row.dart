import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../../logic/handle_validation.dart';
import 'invite_controls.dart';

/// "How you appear" — the display name your circle sees on shared meals, as
/// one 64pt row with a pencil; the pencil swaps the value line for an inline
/// field. An empty draft clears the name back to the handle.
class DisplayNameRow extends ConsumerStatefulWidget {
  const DisplayNameRow({super.key, required this.profile});

  final CircleProfile profile;

  @override
  ConsumerState<DisplayNameRow> createState() => _DisplayNameRowState();
}

class _DisplayNameRowState extends ConsumerState<DisplayNameRow> {
  final TextEditingController _controller = TextEditingController();
  bool _editing = false;
  bool _saving = false;

  String get _current => widget.profile.displayName?.trim() ?? '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    // Null means "clear the name" — omitting the field would mean "keep it".
    final next = normalizeDisplayName(_controller.text);
    if ((next ?? '') == _current) {
      setState(() => _editing = false);
      return;
    }
    setState(() => _saving = true);
    try {
      await saveCircleProfile(
        ref,
        handle: widget.profile.handle,
        displayName: next,
      );
      if (!mounted) return;
      setState(() => _editing = false);
      FocusScope.of(context).unfocus();
      showTopToast(context, tr('groups.invite.appearSaved'));
    } catch (_) {
      if (!mounted) return;
      showTopToast(
        context,
        tr('groups.invite.appearError'),
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
      label: tr('groups.invite.appearTitle'),
      value: _current.isNotEmpty
          ? _current
          : tr('groups.invite.appearFallback'),
      muted: _current.isEmpty,
      actions: [
        InviteGlyphAction(
          icon: LucideIcons.pencil300,
          semanticsLabel: tr('groups.invite.appearEdit'),
          onTap: () {
            _controller.text = _current;
            setState(() => _editing = true);
          },
        ),
      ],
    );
  }

  Widget _buildEditor() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InviteEditorLabel(label: tr('groups.invite.appearTitle')),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  maxLength: kDisplayNameMax,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _save(),
                  style: dashBody(weight: FontWeight.w500),
                  decoration: InputDecoration(
                    hintText: tr('groups.invite.appearPlaceholder'),
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
          Text(tr('groups.invite.appearHint'), style: dashMeta()),
        ],
      ),
    );
  }
}
