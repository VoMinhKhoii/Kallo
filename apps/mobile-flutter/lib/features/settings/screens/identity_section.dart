import 'dart:async';
import 'dart:io' show File;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/api_client.dart';
import '../../../models/circle.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shared/widgets/profile_avatar.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../circle/data/circle_providers.dart';

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
      final bytes = await File(picked.path).readAsBytes();
      if (!mounted) return;
      if (bytes.length > _maxAvatarBytes) {
        showTopToast(context, tr('settings.identity.avatarTooLarge'));
        return;
      }
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
    if (_busy || next.isEmpty || next == saved) return;
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

    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _IdentityBackHeader(onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: profileAsync.when(
              loading: () => const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation(NhamColors.accent),
                ),
              ),
              error: (_, __) => Center(
                child: Text(tr('common.error'), style: dashBody()),
              ),
              data: (profile) {
                if (!_seeded) {
                  _seeded = true;
                  _name.text = profile.displayName?.trim() ?? '';
                }
                return _body(profile);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(CircleProfile profile) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp4,
        NhamSpacing.sp4,
        NhamSpacing.sp6,
      ),
      children: [
        Text(tr('settings.identity.title'), style: dashHeadline()),
        const SizedBox(height: NhamSpacing.sp2),
        Text(
          tr('settings.identity.description'),
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: NhamSpacing.sp5),

        // ── Avatar ──────────────────────────────────────────────────────
        Row(
          children: [
            ProfileAvatarDisc(profile: profile, size: 64),
            const SizedBox(width: NhamSpacing.sp4),
            Expanded(
              child: Wrap(
                spacing: NhamSpacing.sp2,
                runSpacing: NhamSpacing.sp2,
                children: [
                  _PillButton(
                    icon: LucideIcons.upload,
                    label: profile.hasCustomAvatar
                        ? tr('settings.identity.avatarChange')
                        : tr('settings.identity.avatarUpload'),
                    onTap: _busy ? null : _pickAndUpload,
                  ),
                  if (profile.hasCustomAvatar)
                    _PillButton(
                      icon: LucideIcons.x,
                      label: tr('settings.identity.avatarRemove'),
                      onTap: _busy ? null : _removeAvatar,
                      subdued: true,
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp5),

        // ── Name ────────────────────────────────────────────────────────
        Text(
          tr('settings.identity.nameLabel'),
          style: dashBody(weight: FontWeight.w500),
        ),
        const SizedBox(height: NhamSpacing.sp2),
        TextField(
          controller: _name,
          maxLength: _displayNameMax,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _saveName(profile),
          decoration: InputDecoration(
            counterText: '',
            hintText: tr('settings.identity.namePlaceholder'),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(NhamRadii.containerLg),
              borderSide: const BorderSide(color: NhamColors.inputBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(NhamRadii.containerLg),
              borderSide: const BorderSide(color: NhamColors.inputBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(NhamRadii.containerLg),
              borderSide: const BorderSide(color: NhamColors.accent),
            ),
          ),
          style: dashBody(),
        ),
        const SizedBox(height: NhamSpacing.sp3),
        Align(
          alignment: Alignment.centerLeft,
          child: _PillButton(
            icon: LucideIcons.check,
            label: tr('settings.identity.nameSave'),
            onTap: _busy ? null : () => unawaited(_saveName(profile)),
          ),
        ),
        const SizedBox(height: NhamSpacing.sp4),
        Text(
          tr('settings.identity.linkWarning'),
          style: dashBody(color: kInkMuted),
        ),
      ],
    );
  }
}

/// Small pill action button in the brand's warm register.
class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.icon,
    required this.label,
    this.onTap,
    this.subdued = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool subdued;

  @override
  Widget build(BuildContext context) {
    final color = subdued ? kInkMuted : NhamColors.text;
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.5 : 1,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp4,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: subdued ? Colors.transparent : Colors.white,
              borderRadius: BorderRadius.circular(NhamRadii.pill),
              border: Border.all(color: NhamColors.inputBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 14, color: color),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: dashBody(weight: FontWeight.w500, color: color),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Back header mirroring the settings drill-in screens.
class _IdentityBackHeader extends StatelessWidget {
  const _IdentityBackHeader({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: tr('settings.title'),
      onTap: onBack,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onBack,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp4,
            vertical: NhamSpacing.sp3,
          ),
          decoration: const BoxDecoration(
            color: Color(0xE6FDFCF8), // cream @ 90%
            border: Border(bottom: BorderSide(color: NhamColors.inputBorder)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.arrowLeft, size: 16, color: kInkMuted),
              const SizedBox(width: 6),
              Text(
                tr('settings.title'),
                style: dashBody(weight: FontWeight.w500, color: kInkMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
