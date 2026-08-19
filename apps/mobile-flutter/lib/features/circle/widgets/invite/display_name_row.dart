import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';
import '../../data/circle_providers.dart';
import '../../logic/handle_validation.dart';
import 'invite_controls.dart';

/// "How you appear" — the display name your circle sees on shared meals.
/// Read-only (value or muted fallback) with a pencil that opens the inline
/// editor; an empty draft clears the name back to the handle. Mirrors
/// `components/groups/invite/display-name-row.tsx`.
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
    if (_editing) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InviteFieldLabel(
            icon: LucideIcons.user300,
            label: tr('groups.invite.appearTitle'),
          ),
          const SizedBox(height: KalloSpacing.sp1_5),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  maxLength: kDisplayNameMax,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _save(),
                  decoration: InputDecoration(
                    hintText: tr('groups.invite.appearPlaceholder'),
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
            tr('groups.invite.appearHint'),
            style: KalloTextStyles.sansRegular(
              fontSize: KalloFontSize.xxs,
            ).copyWith(color: KalloColors.textMuted),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InviteFieldLabel(
          icon: LucideIcons.user300,
          label: tr('groups.invite.appearTitle'),
        ),
        const SizedBox(height: KalloSpacing.sp1_5),
        Row(
          children: [
            Expanded(
              child: InviteValuePill(
                text:
                    _current.isNotEmpty
                        ? _current
                        : tr('groups.invite.appearFallback'),
                fontSize: KalloFontSize.detail,
                color:
                    _current.isNotEmpty
                        ? KalloColors.text
                        : KalloColors.textMuted70,
              ),
            ),
            const SizedBox(width: KalloSpacing.sp2),
            InviteIconAction(
              icon: LucideIcons.pencil300,
              semanticsLabel: tr('groups.invite.appearEdit'),
              onTap: () {
                _controller.text = _current;
                setState(() => _editing = true);
              },
            ),
          ],
        ),
      ],
    );
  }
}
