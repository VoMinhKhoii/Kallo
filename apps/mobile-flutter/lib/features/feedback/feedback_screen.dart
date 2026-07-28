import 'dart:io' show File, Platform;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../data/api_client.dart';
import '../../shared/widgets/nham_primitives.dart';
import '../../shell/app_header.dart';
import '../../theme/calm_tokens.dart';
import '../../theme/nham_colors.dart';
import '../../theme/nham_theme.dart';

/// Marketing version — kept in sync with `pubspec.yaml` (no `package_info_plus`
/// dependency), mirroring the `_appVersion` constant in the settings screen.
const String _appVersion = '1.0.1';

const int _maxMessageLength = 4000;
const int _maxScreenshotBytes = 5 * 1024 * 1024;

const _feedbackTypes = <_FeedbackType>[
  _FeedbackType('bug', LucideIcons.bug),
  _FeedbackType('ingredient', LucideIcons.sprout),
  _FeedbackType('idea', LucideIcons.lightbulb),
];

class _FeedbackType {
  const _FeedbackType(this.value, this.icon);
  final String value;
  final IconData icon;
}

/// In-app feedback (bug report / ingredient request / idea). Pushed from the
/// settings list; posts to `/api/v1/feedback` with an optional screenshot and
/// auto-captured context (platform, app version, locale, current route).
class FeedbackScreen extends ConsumerStatefulWidget {
  const FeedbackScreen({super.key});

  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends ConsumerState<FeedbackScreen> {
  String _type = 'bug';
  final _message = TextEditingController();
  XFile? _image;
  bool _busy = false;
  bool _sent = false;
  String? _error;
  // Cache the uploaded screenshot path keyed by the picked file, so a failed
  // submit retry reuses the object instead of uploading a new orphan each time.
  String? _uploadedPath;
  String? _uploadedForImagePath;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;
      // Enforce the 5 MB cap up front so slow uploads don't get rejected by the
      // server after the whole file has been sent.
      final length = await File(picked.path).length();
      if (!mounted) return;
      if (length > _maxScreenshotBytes) {
        setState(() {
          _image = null;
          _error = tr('settings.feedback.screenshotTooLarge');
        });
        return;
      }
      setState(() {
        _image = picked;
        _uploadedPath = null;
        _uploadedForImagePath = null;
        _error = null;
      });
    } on PlatformException {
      // Distinguish a permission denial from a plain cancellation.
      if (mounted) {
        setState(() => _error = tr('settings.feedback.photoPermission'));
      }
    } catch (_) {
      // Cancellation / unknown — leave the form as-is.
    }
  }

  String? _platform() {
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return null;
  }

  String _currentRoute() {
    try {
      return GoRouter.of(
        context,
      ).routerDelegate.currentConfiguration.uri.toString();
    } catch (_) {
      return '/settings';
    }
  }

  String _contentTypeFor(XFile file) {
    final mime = file.mimeType;
    if (mime != null && mime.isNotEmpty) return mime;
    final name = file.name.toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  Future<void> _submit() async {
    final message = _message.text.trim();
    if (message.isEmpty || _busy) return;
    // Capture context-derived values before any await (no BuildContext across
    // async gaps).
    final locale = context.locale.languageCode;
    final route = _currentRoute();
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      String? screenshotPath;
      final image = _image;
      if (image != null) {
        if (_uploadedPath != null && _uploadedForImagePath == image.path) {
          // Already uploaded this exact file on a previous (failed) attempt.
          screenshotPath = _uploadedPath;
        } else {
          final bytes = await image.readAsBytes();
          screenshotPath = await api.uploadFeedbackScreenshot(
            bytes: bytes,
            filename: image.name,
            contentType: _contentTypeFor(image),
          );
          _uploadedPath = screenshotPath;
          _uploadedForImagePath = image.path;
        }
      }
      await api.submitFeedback(
        type: _type,
        message: message,
        screenshotPath: screenshotPath,
        appVersion: _appVersion,
        platform: _platform(),
        locale: locale,
        route: route,
      );
      if (mounted) {
        setState(() {
          _sent = true;
          _busy = false;
        });
      }
    } on ApiError catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _busy = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = tr('settings.feedback.error');
          _busy = false;
        });
      }
    }
  }

  void _reset() {
    setState(() {
      _sent = false;
      // Keep the last-selected type — a follow-up is often the same kind.
      _message.clear();
      _image = null;
      _uploadedPath = null;
      _uploadedForImagePath = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
            child: AppHeader(onBack: () => Navigator.of(context).pop()),
          ),
          Expanded(child: _sent ? _buildSent() : _buildForm()),
        ],
      ),
    );
  }

  Widget _buildSent() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.circleCheck,
              size: 40,
              color: NhamColors.text,
            ),
            const SizedBox(height: NhamSpacing.sp4),
            Text(
              tr('settings.feedback.successTitle'),
              textAlign: TextAlign.center,
              style: dashHeadline(),
            ),
            const SizedBox(height: NhamSpacing.sp2),
            Text(
              tr('settings.feedback.successBody'),
              textAlign: TextAlign.center,
              style: dashBody(color: kInkMuted),
            ),
            const SizedBox(height: NhamSpacing.sp5),
            NhamButton(
              title: tr('settings.feedback.done'),
              onPressed: () => Navigator.of(context).pop(),
            ),
            const SizedBox(height: NhamSpacing.sp2),
            NhamButton(
              title: tr('settings.feedback.sendAnother'),
              variant: NhamButtonVariant.ghost,
              onPressed: _reset,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp3,
        NhamSpacing.sp2,
        NhamSpacing.sp3,
        NhamSpacing.sp6,
      ),
      children: [
        Text(tr('settings.feedback.title'), style: dashHeadline()),
        const SizedBox(height: 4),
        Text(tr('settings.feedback.description'), style: dashMeta()),
        const SizedBox(height: NhamSpacing.sp4),

        // Type selector.
        Text(
          tr('settings.feedback.typeLabel').toUpperCase(),
          style: dashEyebrow(),
        ),
        const SizedBox(height: NhamSpacing.sp2),
        Row(
          children: [
            for (var i = 0; i < _feedbackTypes.length; i++) ...[
              if (i > 0) const SizedBox(width: NhamSpacing.sp2),
              Expanded(
                child: _TypeChip(
                  type: _feedbackTypes[i],
                  selected: _type == _feedbackTypes[i].value,
                  onTap: () => setState(() => _type = _feedbackTypes[i].value),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: NhamSpacing.sp4),

        // Message.
        Text(
          tr('settings.feedback.messageLabel').toUpperCase(),
          style: dashEyebrow(),
        ),
        const SizedBox(height: NhamSpacing.sp2),
        Container(
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            border: Border.all(color: NhamColors.borderSoft),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp4,
            vertical: NhamSpacing.sp3,
          ),
          child: TextField(
            controller: _message,
            enabled: !_busy,
            maxLines: 6,
            maxLength: _maxMessageLength,
            // Rebuild so the submit button + counter track what's typed.
            onChanged: (_) => setState(() {}),
            cursorColor: NhamColors.text,
            style: dashBody(),
            decoration: InputDecoration(
              isDense: true,
              counterText: '',
              border: InputBorder.none,
              hintText: tr('settings.feedback.placeholder.$_type'),
              hintStyle: dashBody(color: NhamColors.textMuted),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Align(
          alignment: Alignment.centerRight,
          child: Text(
            '${_message.text.characters.length} / $_maxMessageLength',
            style: dashMeta(tabular: true),
          ),
        ),
        const SizedBox(height: NhamSpacing.sp2),

        // Screenshot.
        _ScreenshotField(
          file: _image,
          onAdd: _busy ? null : _pickImage,
          onRemove: _busy
              ? null
              : () => setState(() {
                  _image = null;
                  _uploadedPath = null;
                  _uploadedForImagePath = null;
                }),
        ),

        if (_error != null) ...[
          const SizedBox(height: NhamSpacing.sp3),
          Text(_error!, style: dashMeta(color: NhamColors.danger)),
        ],

        const SizedBox(height: NhamSpacing.sp5),
        NhamButton(
          title: tr('settings.feedback.submit'),
          loading: _busy,
          disabled: _message.text.trim().isEmpty,
          onPressed: _submit,
        ),
      ],
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({
    required this.type,
    required this.selected,
    required this.onTap,
  });

  final _FeedbackType type;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: tr('settings.feedback.types.${type.value}'),
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
          decoration: BoxDecoration(
            color: selected
                ? NhamColors.hover
                : NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            border: Border.all(
              color: selected ? NhamColors.text.withValues(alpha: 0.3) : NhamColors.borderSoft,
            ),
          ),
          child: Column(
            children: [
              Icon(
                type.icon,
                size: 18,
                color: selected ? NhamColors.text : NhamColors.textMuted,
              ),
              const SizedBox(height: 6),
              Text(
                tr('settings.feedback.types.${type.value}'),
                style: dashMeta(
                  color: selected ? NhamColors.text : NhamColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScreenshotField extends StatelessWidget {
  const _ScreenshotField({
    required this.file,
    required this.onAdd,
    required this.onRemove,
  });

  final XFile? file;
  final VoidCallback? onAdd;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final selected = file;
    if (selected != null) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp3,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: NhamColors.elev,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          border: Border.all(color: NhamColors.borderSoft),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(NhamRadii.sm),
              child: Image.file(
                File(selected.path),
                width: 36,
                height: 36,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                selected.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashBody(),
              ),
            ),
            Semantics(
              button: true,
              label: tr('settings.feedback.removeScreenshot'),
              excludeSemantics: true,
              onTap: onRemove,
              child: GestureDetector(
                onTap: onRemove,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(
                    LucideIcons.x,
                    size: 16,
                    color: NhamColors.textMuted,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Semantics(
      button: true,
      label: tr('settings.feedback.addScreenshot'),
      excludeSemantics: true,
      onTap: onAdd,
      child: GestureDetector(
        onTap: onAdd,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            border: Border.all(color: NhamColors.borderSoft),
          ),
          child: Row(
            children: [
              const Icon(
                LucideIcons.imagePlus,
                size: 16,
                color: NhamColors.textMuted,
              ),
              const SizedBox(width: 8),
              Text(
                tr('settings.feedback.addScreenshot'),
                style: dashBody(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
