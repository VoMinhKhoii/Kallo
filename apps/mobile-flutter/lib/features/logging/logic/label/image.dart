/// Capture and encode a nutrition-label photo for `POST
/// /api/v1/nutrition-label/scan`.
///
/// The picker resizes on the way out at the same width and quality the web's
/// first compression rung uses (`OCR_CLIENT_RESIZE_WIDTH` = 1600, quality
/// 0.85 in `hooks/meals/use-nutrition-ocr.ts`), so both platforms hand the
/// model comparable pixels.
///
/// Parity gap, deliberate: the web retries at four quality/scale rungs when
/// the first encode overshoots the budget. Here the picker's own resize is
/// the single pass, and only a still that STILL overshoots the size guard
/// (a live-camera capture, which the `camera` plugin hands over at whatever
/// size the sensor produced) gets one more rung: `shrinkLabelImageFile` in
/// `image_shrink.dart` downscales to the same 1600px / q85 with the pure-Dart
/// `image` package, off the UI isolate, so the size guard rejects nothing a
/// resize would save.
library;

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart' show PlatformException;
import 'package:image_picker/image_picker.dart';

/// Mirrors `OCR_MAX_IMAGE_BYTES` in `lib/nutrition/ocr-image-constants.ts`.
const int maxLabelImageBytes = 4 * 1024 * 1024;

/// Mirrors `OCR_CLIENT_RESIZE_WIDTH`.
const double labelImageMaxWidth = 1600;

/// The web's first `ENCODE_ATTEMPTS` rung (quality 0.85).
const int labelImageQuality = 85;

class LabelImage {
  const LabelImage({
    required this.bytes,
    required this.mimeType,
    required this.path,
  });

  final Uint8List bytes;

  /// One of the three types the server accepts, derived from the bytes rather
  /// than the file extension — the server re-derives it the same way and
  /// rejects a mismatch.
  final String mimeType;

  /// On-disk path, used only for the preview thumbnail.
  final String path;
}

/// Why a capture produced no usable image. [cancelled] is not an error — the
/// user backed out of the picker. [cameraUnavailable] is the in-sheet live
/// preview failing to open or to shoot for a reason that is NOT a denied
/// permission (no camera on the device, the sensor busy elsewhere, a plugin
/// error) — a plain retry, not a trip to Settings.
enum LabelImageFailure {
  cancelled,
  permissionDenied,
  cameraUnavailable,
  tooLarge,
  unsupported,
}

class LabelImageResult {
  const LabelImageResult.success(LabelImage this.image) : failure = null;
  const LabelImageResult.failure(LabelImageFailure this.failure) : image = null;

  final LabelImage? image;
  final LabelImageFailure? failure;
}

/// Standard base64 (never url-safe) — the server's contract validates against
/// `[A-Za-z0-9+/]` with at most two '=' of padding.
String base64EncodeLabelImage(LabelImage image) => base64Encode(image.bytes);

/// Detect the image type from its magic bytes. Same three-way check as
/// `detectOcrImageMime` in `lib/nutrition/ocr-image.ts`; anything else is
/// unsupported.
String? detectLabelImageMime(Uint8List bytes) {
  bool startsWith(List<int> prefix) {
    if (bytes.length < prefix.length) return false;
    for (var i = 0; i < prefix.length; i++) {
      if (bytes[i] != prefix[i]) return false;
    }
    return true;
  }

  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (bytes.length >= 12) {
    final riff = String.fromCharCodes(bytes.sublist(0, 4));
    final webp = String.fromCharCodes(bytes.sublist(8, 12));
    if (riff == 'RIFF' && webp == 'WEBP') return 'image/webp';
  }
  return null;
}

/// Take (or choose) a label photo. Reads the file only after checking its
/// on-disk size, so an oversized image is never buffered just to reject it —
/// the same guard the avatar and feedback pickers use.
Future<LabelImageResult> captureLabelImage(
  ImageSource source, {
  ImagePicker? picker,
}) async {
  try {
    final picked = await (picker ?? ImagePicker()).pickImage(
      source: source,
      maxWidth: labelImageMaxWidth,
      imageQuality: labelImageQuality,
    );
    if (picked == null) {
      return const LabelImageResult.failure(LabelImageFailure.cancelled);
    }
    return labelImageFromFile(picked.path);
  } on PlatformException {
    // Distinguish a denied camera/photo permission from a plain cancellation,
    // as `feedback_screen.dart` does.
    return const LabelImageResult.failure(LabelImageFailure.permissionDenied);
  } catch (_) {
    return const LabelImageResult.failure(LabelImageFailure.cancelled);
  }
}

/// Read a still already on disk into a [LabelImage]: on-disk size guard first
/// so an oversized photo is never buffered just to reject it, then the bytes,
/// then the mime derived from them.
///
/// Both capture paths end here — the photo-library picker (resized to
/// [labelImageMaxWidth] on the way out) and the in-sheet live camera, which
/// hands over the still it just wrote.
Future<LabelImageResult> labelImageFromFile(String path) async {
  try {
    final file = File(path);
    if (await file.length() > maxLabelImageBytes) {
      return const LabelImageResult.failure(LabelImageFailure.tooLarge);
    }

    final bytes = await file.readAsBytes();
    if (bytes.isEmpty || bytes.length > maxLabelImageBytes) {
      return const LabelImageResult.failure(LabelImageFailure.tooLarge);
    }

    final mimeType = detectLabelImageMime(bytes);
    if (mimeType == null) {
      return const LabelImageResult.failure(LabelImageFailure.unsupported);
    }

    return LabelImageResult.success(
      LabelImage(bytes: bytes, mimeType: mimeType, path: path),
    );
  } on FileSystemException {
    // The file the camera or picker named is gone or unreadable. Nothing to
    // send; ask for another shot rather than crashing the sheet.
    return const LabelImageResult.failure(LabelImageFailure.cameraUnavailable);
  }
}

/// Map a `CameraException.code` onto the failure the sheet reports. Only a
/// refused permission is worth sending someone to Settings for; the rest are
/// retries. Takes the code rather than the exception so this file stays free
/// of `package:camera`.
LabelImageFailure labelFailureForCamera(String code) => switch (code) {
  'CameraAccessDenied' ||
  'CameraAccessDeniedWithoutPrompt' ||
  'CameraAccessRestricted' => LabelImageFailure.permissionDenied,
  _ => LabelImageFailure.cameraUnavailable,
};
