import 'dart:io' show File, Platform;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../services/http/api_client.dart';
import '../../../shared/widgets/chrome/page_header.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../widgets/feedback_form.dart';
import '../widgets/feedback_success.dart';

/// Marketing version — kept in sync with `pubspec.yaml` (no `package_info_plus`
/// dependency), mirroring the `_appVersion` constant in the settings screen.
const String _appVersion = '1.0.1';

const int _maxScreenshotBytes = 5 * 1024 * 1024;

/// In-app feedback (bug report / ingredient request / idea). Pushed from the
/// settings list; posts to `/api/v1/feedback` with an optional screenshot and
/// auto-captured context (platform, app version, locale, current route).
///
/// Chrome-wise it is a settings sub-page like any other: [PageHeader] carries
/// the title beside the back chevron and the body never repeats it.
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
  void initState() {
    super.initState();
    // The character counter and the submit button's enabled state both read
    // the controller, so every keystroke has to rebuild the form.
    _message.addListener(_onMessageChanged);
  }

  @override
  void dispose() {
    _message.removeListener(_onMessageChanged);
    _message.dispose();
    super.dispose();
  }

  void _onMessageChanged() {
    if (mounted) setState(() {});
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
      child: ScrollSeparator(
        // Flush to the screen edge, exactly as every settings sub-page mounts
        // it: the 44pt back slot reclaims the page's own 12pt inset so the
        // chevron is optically flush.
        header: PageHeader(
          title: tr('settings.feedback.title'),
          onBack: () => Navigator.of(context).pop(),
        ),
        child: _sent
            ? FeedbackSuccess(
                onDone: () => Navigator.of(context).pop(),
                onSendAnother: _reset,
              )
            : FeedbackForm(
                type: _type,
                onTypeChanged: (v) => setState(() => _type = v),
                message: _message,
                image: _image,
                busy: _busy,
                error: _error,
                onPickImage: _pickImage,
                onRemoveImage: () => setState(() {
                  _image = null;
                  _uploadedPath = null;
                  _uploadedForImagePath = null;
                }),
                onSubmit: _submit,
              ),
      ),
    );
  }
}
