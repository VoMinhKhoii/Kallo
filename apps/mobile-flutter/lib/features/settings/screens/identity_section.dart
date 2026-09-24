import 'dart:async';
import 'dart:io' show File;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../models/social/circle.dart';
import '../../../shared/widgets/form/kallo_text_field.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../shared/widgets/feedback/skeleton.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../circle/data/circle_providers.dart';
import '../logic/settings_spacing.dart';
import '../widgets/profile/photo_action_sheet.dart';
import '../../../shared/widgets/form/save_dock.dart';
import '../../../shared/widgets/chrome/inline_nav_bar.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../models/http/api_error.dart';

const int _maxAvatarBytes = 5 * 1024 * 1024;
const int _displayNameMax = 50;

/// Identity editor — avatar photo + "what should we call you". Pushed from
/// the settings list. Renaming re-derives the invite handle server-side, so
/// the screen warns that old invite links stop working. Mirrors the web
/// settings identity panel against the same `/api/v1/groups/profile/*` REST
/// contract.
class IdentityScreen extends ConsumerStatefulWidget {
  const IdentityScreen({super.key});

  @override
  ConsumerState<IdentityScreen> createState() => _IdentityScreenState();
}

class _IdentityScreenState extends ConsumerState<IdentityScreen> {
  final _name = TextEditingController();
  bool _seeded = false;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  String _contentTypeFor(XFile file) {
    final mime = file.mimeType;
    if (mime != null && mime.isNotEmpty) return mime;
    final name = file.name.toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  Future<void> _pickAndUpload() async {
    if (_busy) return;
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;
      // Check the on-disk size before reading the whole file into memory — a
      // large PNG/HEIC that bypassed picker compression shouldn't be buffered
      // just to reject it.
      final file = File(picked.path);
      if (await file.length() > _maxAvatarBytes) {
        if (!mounted) return;
        showTopToast(context, tr('settings.identity.avatarTooLarge'));
        return;
      }
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() => _busy = true);
      await uploadCircleAvatar(
        ref,
        bytes: bytes,
        filename: picked.name,
        contentType: _contentTypeFor(picked),
      );
      if (!mounted) return;
      showTopToast(context, tr('settings.identity.avatarSaved'));
    } on PlatformException {
      if (mounted) {
        showTopToast(context, tr('settings.feedback.photoPermission'));
      }
    } on ApiError {
      if (mounted) showTopToast(context, tr('settings.identity.avatarError'));
    } catch (_) {
      // Cancellation / unknown — leave the screen as-is.
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _removeAvatar() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await removeCircleAvatar(ref);
      if (!mounted) return;
      showTopToast(context, tr('settings.identity.avatarRemoved'));
    } on ApiError {
      if (mounted) showTopToast(context, tr('settings.identity.avatarError'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveName(CircleProfile profile) async {
    final next = _name.text.trim();
    final saved = profile.displayName?.trim() ?? '';
    if (_busy || next == saved) return;
    // Every other path here toasts — an empty name shouldn't be a silent no-op.
    if (next.isEmpty) {
      showTopToast(context, tr('settings.identity.nameRequired'));
      return;
    }
    setState(() => _busy = true);
    try {
      await renameCircleProfile(ref, next);
      if (!mounted) return;
      showTopToast(context, tr('settings.identity.nameSaved'));
    } on ApiError {
      if (mounted) showTopToast(context, tr('settings.identity.nameError'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(myCircleProfileProvider);
    // Seed the field BEFORE anything reads it: the dock's "changed?" compares
    // this text with the saved name, and an unseeded field reads as an edit.
    if (!_seeded && profileAsync.hasValue) {
      _seeded = true;
      _name.text = profileAsync.value!.displayName?.trim() ?? '';
    }

    return Screen(
      bottom: false,
      child: ScrollSeparator(
        header: InlineNavBar(
          title: tr('settings.identity.title'),
          parentTitle: tr('settings.title'),
        ),
        overlay: profileAsync.hasValue ? _dock(profileAsync.value!) : null,
        child: profileAsync.when(
          loading: () => const _IdentitySkeleton(),
          error:
              (_, __) =>
                  Center(child: Text(tr('common.error'), style: dashBody())),
          data: _body,
        ),
      ),
    );
  }

  /// The name as saved, so the dock can tell an edit from a no-op.
  bool _nameChanged(CircleProfile profile) =>
      _name.text.trim() != (profile.displayName?.trim() ?? '');

  Widget _dock(CircleProfile profile) => SaveDock(
    visible: _nameChanged(profile),
    loading: _busy,
    label: tr('settings.identity.nameSave'),
    onPressed: () => unawaited(_saveName(profile)),
  );

  Future<void> _editPhoto(CircleProfile profile) async {
    if (_busy) return;
    final action = await showPhotoActions(
      context,
      hasCustomAvatar: profile.hasCustomAvatar,
    );
    switch (action) {
      case PhotoAction.pick:
        await _pickAndUpload();
      case PhotoAction.remove:
        await _removeAvatar();
      case null:
        break;
    }
  }

  Widget _body(CircleProfile profile) {
    final padding = SettingsSpacing.rowList(context);
    return ListView(
      padding: padding.copyWith(bottom: padding.bottom + SaveDock.clearance),
      children: [
        // ── Avatar — the picture, and one quiet way to change it ─────────
        Center(child: ProfileAvatarDisc(profile: profile, size: 88)),
        Center(
          child: CupertinoButton(
            minimumSize: const Size.square(KalloIcons.hit),
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
            onPressed: _busy ? null : () => unawaited(_editPhoto(profile)),
            child: Text(tr('settings.identity.avatarEdit'), style: dashBody()),
          ),
        ),
        const SizedBox(height: KalloSpacing.sp3),

        // ── Name — the field, and what renaming costs ────────────────────
        GroupLabel(tr('settings.identity.nameLabel')),
        const SizedBox(height: SettingsSpacing.label),
        KalloTextField(
          controller: _name,
          maxLength: _displayNameMax,
          hintText: tr('settings.identity.namePlaceholder'),
          textInputAction: TextInputAction.done,
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) => _saveName(profile),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Text(tr('settings.identity.linkWarning'), style: dashMeta()),
      ],
    );
  }
}

/// Profile-load skeleton for the identity screen: the description bar, then an
/// avatar disc beside a name bar.
class _IdentitySkeleton extends StatelessWidget {
  const _IdentitySkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('common.loading'),
      child: SkeletonPulse(
        child: ListView(
          padding: SettingsSpacing.rowList(context),
          children: const [
            // Mirrors the real body, which opens on the centred avatar.
            Center(child: SkeletonCircle(size: 88)),
          ],
        ),
      ),
    );
  }
}
