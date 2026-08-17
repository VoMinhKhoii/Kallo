import 'dart:async';
import 'dart:io' show File;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../services/http/api_client.dart';
import '../../../models/social/circle.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../shared/widgets/feedback/skeleton.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../circle/data/circle_providers.dart';
import '../logic/settings_spacing.dart';
import '../widgets/chrome/settings_header.dart';

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

    return Screen(
      bottom: false,
      child: ScrollSeparator(
        header: SettingsHeader(title: tr('settings.identity.title')),
        child: profileAsync.when(
          loading: () => const _IdentitySkeleton(),
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
    );
  }

  Widget _body(CircleProfile profile) {
    return ListView(
      padding: SettingsSpacing.page,
      children: [
        // No title here — it lives in the header bar. This is the description
        // that used to sit under it.
        Text(
          tr('settings.identity.description'),
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: KalloSpacing.sp5),

        // ── Avatar ──────────────────────────────────────────────────────
        Row(
          children: [
            ProfileAvatarDisc(profile: profile, size: 64),
            const SizedBox(width: KalloSpacing.sp4),
            Expanded(
              child: Wrap(
                spacing: KalloSpacing.sp2,
                runSpacing: KalloSpacing.sp2,
                children: [
                  _PillButton(
                    icon: LucideIcons.upload300,
                    label: profile.hasCustomAvatar
                        ? tr('settings.identity.avatarChange')
                        : tr('settings.identity.avatarUpload'),
                    onTap: _busy ? null : _pickAndUpload,
                  ),
                  if (profile.hasCustomAvatar)
                    _PillButton(
                      icon: LucideIcons.x300,
                      label: tr('settings.identity.avatarRemove'),
                      onTap: _busy ? null : _removeAvatar,
                      subdued: true,
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp5),

        // ── Name ────────────────────────────────────────────────────────
        Text(
          tr('settings.identity.nameLabel'),
          style: dashBody(weight: FontWeight.w500),
        ),
        const SizedBox(height: KalloSpacing.sp2),
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
              borderRadius: BorderRadius.circular(KalloRadii.containerLg),
              borderSide: const BorderSide(color: KalloColors.inputBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(KalloRadii.containerLg),
              borderSide: const BorderSide(color: KalloColors.inputBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(KalloRadii.containerLg),
              borderSide: const BorderSide(color: KalloColors.accent),
            ),
          ),
          style: dashBody(),
        ),
        const SizedBox(height: KalloSpacing.sp3),
        Align(
          alignment: Alignment.centerLeft,
          child: _PillButton(
            icon: LucideIcons.check300,
            label: tr('settings.identity.nameSave'),
            onTap: _busy ? null : () => unawaited(_saveName(profile)),
          ),
        ),
        const SizedBox(height: KalloSpacing.sp4),
        Text(
          tr('settings.identity.linkWarning'),
          style: dashBody(color: kInkMuted),
        ),
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
          padding: SettingsSpacing.page,
          children: const [
            // Mirrors the real body: description line, then the avatar row.
            SkeletonBar(widthFactor: 0.9, height: 12, radius: 6),
            SizedBox(height: KalloSpacing.sp5),
            Row(
              children: [
                SkeletonCircle(size: 64),
                SizedBox(width: KalloSpacing.sp4),
                Expanded(child: SkeletonBar(height: 14, radius: 6)),
              ],
            ),
          ],
        ),
      ),
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
    final color = subdued ? kInkMuted : KalloColors.text;
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
              horizontal: KalloSpacing.sp4,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: subdued ? Colors.transparent : Colors.white,
              borderRadius: BorderRadius.circular(KalloRadii.pill),
              border: Border.all(color: KalloColors.inputBorder),
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

