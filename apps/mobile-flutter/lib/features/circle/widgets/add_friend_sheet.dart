import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/api_client.dart';
import '../../../data/env.dart';
import '../../../models/circle.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/circle_providers.dart';
import '../../../shared/widgets/profile_avatar.dart';
import 'circle_error.dart';

/// Opens the invite surface: your shareable link (with an editable end), your
/// display name, and your circle. No username search, no requests — people
/// connect by opening your link and tapping Accept. Mirrors `AddFriendDialog`.
Future<void> showAddFriendSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _AddFriendSheet(),
  );
}

/// The `^[a-z0-9_]{3,20}$` shape the server enforces — light client mirror so
/// obviously-bad input is flagged inline before the round-trip (the server
/// still owns the reserved-word + uniqueness checks).
final _handleShape = RegExp(r'^[a-z0-9_]{3,20}$');

/// Web `DISPLAY_NAME_MAX` — the server schema caps at 50 too.
const int _displayNameMax = 50;

class _AddFriendSheet extends ConsumerWidget {
  const _AddFriendSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final maxHeight = MediaQuery.of(context).size.height * 0.85;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: NhamColors.surface,
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(NhamRadii.xxl)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header — X (close) + centered title.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp2,
              NhamSpacing.sp2,
              NhamSpacing.sp2,
              NhamSpacing.sp1,
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(LucideIcons.x, size: 22),
                  color: NhamColors.textMuted,
                  tooltip: tr('groups.invite.cancel'),
                ),
                Expanded(
                  child: Center(
                    child: Text(
                      tr('groups.invite.title'),
                      style: NhamTextStyles.serifRegular(
                        fontSize: NhamFontSize.h4,
                      ).copyWith(color: NhamColors.text),
                    ),
                  ),
                ),
                const SizedBox(width: 48, height: 48),
              ],
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                NhamSpacing.sp4,
                0,
                NhamSpacing.sp4,
                viewInsets + NhamSpacing.sp5,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('groups.invite.description'),
                    style: NhamTextStyles.sansRegular(
                      fontSize: NhamFontSize.detail,
                      height: NhamLeading.relaxed,
                    ).copyWith(color: NhamColors.textMuted),
                  ),
                  const SizedBox(height: NhamSpacing.sp4),
                  const _ProfileSection(),
                  const SizedBox(height: NhamSpacing.sp5),
                  const _CircleListSection(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Profile: display name + editable invite link
// ---------------------------------------------------------------------------

class _ProfileSection extends ConsumerWidget {
  const _ProfileSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(myCircleProfileProvider);
    return profileAsync.when(
      loading: () => Container(
        height: 84,
        decoration: BoxDecoration(
          color: NhamColors.hover50,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
        ),
      ),
      error: (_, __) => CircleErrorCard(
        onRetry: () => ref.invalidate(myCircleProfileProvider),
      ),
      data: (profile) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DisplayNameRow(profile: profile),
          const SizedBox(height: NhamSpacing.sp4),
          _InviteLinkRow(profile: profile),
        ],
      ),
    );
  }
}

/// "How you appear" — the display name your circle sees on shared meals.
/// Read-only (value or muted fallback) with a pencil that opens the inline
/// editor; an empty draft clears the name back to the handle. Mirrors
/// `components/groups/invite/display-name-row.tsx`.
class _DisplayNameRow extends ConsumerStatefulWidget {
  const _DisplayNameRow({required this.profile});

  final CircleProfile profile;

  @override
  ConsumerState<_DisplayNameRow> createState() => _DisplayNameRowState();
}

class _DisplayNameRowState extends ConsumerState<_DisplayNameRow> {
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
    final next = _controller.text.trim();
    if (next == _current) {
      setState(() => _editing = false);
      return;
    }
    setState(() => _saving = true);
    try {
      // An empty draft clears the name (explicit null — omitting means keep).
      await saveCircleProfile(
        ref,
        handle: widget.profile.handle,
        displayName: next.isEmpty ? null : next,
      );
      if (!mounted) return;
      setState(() => _editing = false);
      FocusScope.of(context).unfocus();
      showTopToast(context, tr('groups.invite.appearSaved'));
    } catch (_) {
      if (!mounted) return;
      showTopToast(context, tr('groups.invite.appearError'),
          variant: TopToastVariant.error);
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
          _FieldLabel(
              icon: LucideIcons.user, label: tr('groups.invite.appearTitle')),
          const SizedBox(height: NhamSpacing.sp1_5),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  maxLength: _displayNameMax,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _save(),
                  decoration: InputDecoration(
                    hintText: tr('groups.invite.appearPlaceholder'),
                    isDense: true,
                    counterText: '',
                  ),
                  style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.sm)
                      .copyWith(color: NhamColors.text),
                ),
              ),
              const SizedBox(width: NhamSpacing.sp2),
              _IconAction(
                icon: LucideIcons.check,
                semanticsLabel: tr('groups.invite.save'),
                loading: _saving,
                onTap: _save,
                filled: true,
              ),
              const SizedBox(width: NhamSpacing.sp2),
              _IconAction(
                icon: LucideIcons.x,
                semanticsLabel: tr('groups.invite.cancel'),
                onTap: () => setState(() => _editing = false),
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp1_5),
          Text(
            tr('groups.invite.appearHint'),
            style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xxs)
                .copyWith(color: NhamColors.textMuted),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _FieldLabel(
            icon: LucideIcons.user, label: tr('groups.invite.appearTitle')),
        const SizedBox(height: NhamSpacing.sp1_5),
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: NhamSpacing.sp3,
                  vertical: NhamSpacing.sp2_5,
                ),
                decoration: BoxDecoration(
                  color: NhamColors.elev,
                  borderRadius: BorderRadius.circular(NhamRadii.lg),
                  border: Border.all(color: NhamColors.borderSoft),
                ),
                child: Text(
                  _current.isNotEmpty
                      ? _current
                      : tr('groups.invite.appearFallback'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.detail,
                  ).copyWith(
                    color: _current.isNotEmpty
                        ? NhamColors.text
                        : NhamColors.textMuted70,
                  ),
                ),
              ),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            _IconAction(
              icon: LucideIcons.pencil,
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

/// The read-only invite link with Copy + inline slug editing. The edit mode
/// validates inline (red issue line, disabled save) like the web
/// `InviteLinkSection`.
class _InviteLinkRow extends ConsumerStatefulWidget {
  const _InviteLinkRow({required this.profile});

  final CircleProfile profile;

  @override
  ConsumerState<_InviteLinkRow> createState() => _InviteLinkRowState();
}

class _InviteLinkRowState extends ConsumerState<_InviteLinkRow> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.profile.handle)
        ..addListener(_onDraftChanged);
  bool _editing = false;
  bool _saving = false;

  String get _origin => Env.apiBaseUrl;

  String _inviteLink(String handle) =>
      '$_origin/${context.locale.languageCode}/invite/$handle';

  /// The draft as the server would see it: trimmed, lowercased, leading @s
  /// stripped (people paste "@handle" from social bios).
  String get _normalized => _controller.text
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'^@+'), '');

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
    final normalized = _normalized;
    final canSave = _handleShape.hasMatch(normalized) &&
        normalized != widget.profile.handle &&
        !_saving;
    if (!canSave) return;
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
      final msg = code == 'CONFLICT'
          ? tr('groups.invite.endTaken')
          : tr('groups.invite.endError');
      showTopToast(context, msg, variant: TopToastVariant.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_editing) {
      final normalized = _normalized;
      final valid = _handleShape.hasMatch(normalized);
      // Only surface the issue once they've typed a plausible length — the
      // web waits for HANDLE_MIN_LENGTH before flagging.
      final showIssue = !valid && normalized.length >= 3;
      final canSave = valid && normalized != widget.profile.handle && !_saving;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _FieldLabel(
              icon: LucideIcons.pencil, label: tr('groups.invite.editTitle')),
          const SizedBox(height: NhamSpacing.sp1_5),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  autocorrect: false,
                  enableSuggestions: false,
                  textCapitalization: TextCapitalization.none,
                  maxLength: 20,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _save(),
                  decoration: const InputDecoration(
                    prefixText: '…/invite/',
                    isDense: true,
                    counterText: '',
                  ),
                  style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.sm)
                      .copyWith(color: NhamColors.text),
                ),
              ),
              const SizedBox(width: NhamSpacing.sp2),
              _IconAction(
                icon: LucideIcons.check,
                semanticsLabel: tr('groups.invite.save'),
                loading: _saving,
                disabled: !canSave,
                onTap: _save,
                filled: true,
              ),
              const SizedBox(width: NhamSpacing.sp2),
              _IconAction(
                icon: LucideIcons.x,
                semanticsLabel: tr('groups.invite.cancel'),
                onTap: () => setState(() => _editing = false),
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp1_5),
          Text(
            showIssue
                ? tr('groups.invite.endInvalid')
                : tr('groups.invite.editHint'),
            style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xxs)
                .copyWith(
              color: showIssue ? NhamColors.danger : NhamColors.textMuted,
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _FieldLabel(
            icon: LucideIcons.link2, label: tr('groups.invite.yourLink')),
        const SizedBox(height: NhamSpacing.sp1_5),
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: NhamSpacing.sp3,
                  vertical: NhamSpacing.sp2_5,
                ),
                decoration: BoxDecoration(
                  color: NhamColors.elev,
                  borderRadius: BorderRadius.circular(NhamRadii.lg),
                  border: Border.all(color: NhamColors.borderSoft),
                ),
                child: Text(
                  _inviteLink(widget.profile.handle),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xs)
                      .copyWith(color: NhamColors.textMuted),
                ),
              ),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            _IconAction(
              icon: LucideIcons.pencil,
              semanticsLabel: tr('groups.invite.editTitle'),
              onTap: () {
                _controller.text = widget.profile.handle;
                setState(() => _editing = true);
              },
            ),
            const SizedBox(width: NhamSpacing.sp2),
            _CopyButton(onTap: _copy),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp1_5),
        Text(
          tr('groups.invite.hint'),
          style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xxs)
              .copyWith(color: NhamColors.textMuted60),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Circle list
// ---------------------------------------------------------------------------

class _CircleListSection extends ConsumerWidget {
  const _CircleListSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final friendsAsync = ref.watch(circleFriendsProvider);
    return friendsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => CircleErrorCard(
        onRetry: () => ref.invalidate(circleFriendsProvider),
      ),
      data: (members) {
        final circle = members.where((m) => m.isAccepted).toList();
        if (circle.isEmpty) {
          return Text(
            tr('groups.circle.empty'),
            style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xs)
                .copyWith(color: NhamColors.textMuted),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NhamText(
              tr('groups.circle.title',
                  namedArgs: {'count': '${circle.length}'}),
              variant: NhamTextVariant.eyebrow,
            ),
            const SizedBox(height: NhamSpacing.sp2),
            for (final member in circle) ...[
              _MemberRow(member: member),
              const SizedBox(height: NhamSpacing.sp2),
            ],
          ],
        );
      },
    );
  }
}

class _MemberRow extends ConsumerStatefulWidget {
  const _MemberRow({required this.member});

  final CircleMember member;

  @override
  ConsumerState<_MemberRow> createState() => _MemberRowState();
}

class _MemberRowState extends ConsumerState<_MemberRow> {
  bool _removing = false;

  Future<void> _remove() async {
    if (_removing) return;
    setState(() => _removing = true);
    try {
      await removeCircleFriend(ref, widget.member.profile.userId);
      // The list re-renders from the invalidated provider; nothing else to do.
    } catch (_) {
      if (!mounted) return;
      setState(() => _removing = false);
      showTopToast(context, tr('groups.circle.removeError'),
          variant: TopToastVariant.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.member.profile;
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp3),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
      ),
      child: Row(
        children: [
          ProfileAvatarDisc(profile: profile, size: 36),
          const SizedBox(width: NhamSpacing.sp3),
          Expanded(
            child: Text(
              profile.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.sm)
                  .copyWith(color: NhamColors.text),
            ),
          ),
          Opacity(
            opacity: _removing ? 0.55 : 1,
            child: GestureDetector(
              onTap: _removing ? null : _remove,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: NhamSpacing.sp2_5,
                  vertical: NhamSpacing.sp1_5,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(NhamRadii.md),
                  border: Border.all(color: NhamColors.borderSoft),
                ),
                child: Text(
                  tr('groups.circle.remove'),
                  style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                      .copyWith(color: NhamColors.textMuted),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 13, color: NhamColors.textMuted),
        const SizedBox(width: NhamSpacing.sp1_5),
        NhamText(label, variant: NhamTextVariant.eyebrow),
      ],
    );
  }
}

class _CopyButton extends StatelessWidget {
  const _CopyButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp3,
          vertical: NhamSpacing.sp2_5,
        ),
        decoration: BoxDecoration(
          color: NhamColors.elev,
          borderRadius: BorderRadius.circular(NhamRadii.lg),
          border: Border.all(color: NhamColors.borderSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.copy, size: 14, color: NhamColors.text),
            const SizedBox(width: NhamSpacing.sp1_5),
            Text(
              tr('groups.invite.copy'),
              style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                  .copyWith(color: NhamColors.text),
            ),
          ],
        ),
      ),
    );
  }
}

/// A square icon button — filled (umber) for the primary confirm, or a hairline
/// outline for secondary actions (cancel / edit). Dims + ignores taps when
/// [disabled].
class _IconAction extends StatelessWidget {
  const _IconAction({
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
    this.filled = false,
    this.loading = false,
    this.disabled = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool filled;
  final bool loading;
  final bool disabled;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final inert = loading || disabled;
    return Semantics(
      button: true,
      label: semanticsLabel,
      child: Opacity(
        opacity: disabled ? 0.55 : 1,
        child: GestureDetector(
          onTap: inert ? null : onTap,
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: filled ? NhamColors.btn : NhamColors.elev,
              borderRadius: BorderRadius.circular(NhamRadii.lg),
              border: filled ? null : Border.all(color: NhamColors.borderSoft),
            ),
            child: loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Icon(
                    icon,
                    size: 18,
                    color: filled ? Colors.white : NhamColors.textMuted,
                  ),
          ),
        ),
      ),
    );
  }
}
