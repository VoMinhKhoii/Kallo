/// Riverpod state for the nutrition-label branch of the scan sheet: take (or
/// choose) a photo → `POST /api/v1/nutrition-label/scan` → review the
/// extracted values → `POST /api/v1/nutrition-label/log` (stage + confirm in
/// one server-side call — no pending card).
///
/// Kept separate from [barcodeFlowProvider] rather than merged into it: the
/// barcode controller is already covered end to end, and two small
/// controllers read better than one that branches on scan type. The sheet owns
/// the toggle between them.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

import '../../../services/http/api_client.dart';
import '../../../models/nutrition_label.dart';
import '../logic/label/image.dart';
import '../logic/label/review.dart';
import 'logging_keys.dart';
import 'logging_providers.dart';

const _uuid = Uuid();

/// How the controller gets a photo. Behind a provider purely so tests can
/// stand in for the platform picker, which has no test surface of its own.
typedef LabelImageCapture =
    Future<LabelImageResult> Function(ImageSource source);

final labelImageCaptureProvider = Provider<LabelImageCapture>(
  (ref) => captureLabelImage,
);

/// Where the sheet is in the capture → scan → review → save flow.
enum LabelScanPhase { capture, preview, scanning, review, saving }

class LabelScanState {
  const LabelScanState({
    this.phase = LabelScanPhase.capture,
    this.image,
    this.label,
    this.errorKey,
  });

  final LabelScanPhase phase;

  /// The photo awaiting (or undergoing) a scan. Kept across a failed scan so
  /// "try this photo again" doesn't make the user shoot it twice.
  final LabelImage? image;

  final NutritionLabel? label;

  /// l10n key for the current error (`logging.labelScan.error.*`), shown as an
  /// inline card. Null when no error.
  final String? errorKey;

  LabelScanState copyWith({
    LabelScanPhase? phase,
    LabelImage? Function()? image,
    NutritionLabel? Function()? label,
    String? Function()? errorKey,
  }) => LabelScanState(
    phase: phase ?? this.phase,
    image: image != null ? image() : this.image,
    label: label != null ? label() : this.label,
    errorKey: errorKey != null ? errorKey() : this.errorKey,
  );

  /// The one error where switching to the barcode scanner is a better exit
  /// than reshooting the same wrong side of the package.
  bool get isNoLabelDetected =>
      errorKey == 'logging.labelScan.error.noLabelDetected';
}

/// Map an [ApiError] from the label endpoints onto a stable l10n key. The
/// server returns locale-agnostic codes; copy is resolved client-side so it
/// honors the app locale. Mirrors the barcode controller's `_errorKeyFor`.
String _errorKeyFor(Object error) {
  if (error is ApiError) {
    switch (error.code) {
      case 'OCR_INVALID_IMAGE':
        return 'logging.labelScan.error.invalidImage';
      case 'OCR_NO_LABEL_DETECTED':
        return 'logging.labelScan.error.noLabelDetected';
      case 'OCR_RATE_LIMITED':
        return 'logging.labelScan.error.rateLimited';
      case 'VALIDATION_FAILED':
        return 'logging.labelScan.error.invalidImage';
    }
  }
  return 'logging.labelScan.error.serverError';
}

String _captureErrorKeyFor(LabelImageFailure failure) => switch (failure) {
  LabelImageFailure.permissionDenied =>
    'logging.labelScan.error.permissionDenied',
  LabelImageFailure.tooLarge => 'logging.labelScan.error.imageTooLarge',
  LabelImageFailure.unsupported => 'logging.labelScan.error.invalidImage',
  // Backing out of the picker is not an error — handled before this is called.
  LabelImageFailure.cancelled => 'logging.labelScan.error.serverError',
};

/// One label-sheet session: capture, scan, and log, with single-flight guards
/// so double taps can't double-scan or double-log.
class LabelScanController extends AutoDisposeNotifier<LabelScanState> {
  @override
  LabelScanState build() => const LabelScanState();

  /// Take or choose a label photo. A cancelled picker leaves the state alone
  /// so the user lands back where they were.
  Future<void> pickImage(ImageSource source) async {
    if (state.phase == LabelScanPhase.scanning ||
        state.phase == LabelScanPhase.saving) {
      return;
    }

    final result = await ref.read(labelImageCaptureProvider)(source);
    final failure = result.failure;
    if (failure == LabelImageFailure.cancelled) return;
    if (failure != null) {
      state = state.copyWith(
        phase: LabelScanPhase.capture,
        image: () => null,
        errorKey: () => _captureErrorKeyFor(failure),
      );
      return;
    }

    state = state.copyWith(
      phase: LabelScanPhase.preview,
      image: () => result.image,
      label: () => null,
      errorKey: () => null,
    );
  }

  /// Send the held photo to the vision model. On failure the photo is kept so
  /// a retry is one tap away.
  Future<void> scan() async {
    final image = state.image;
    if (image == null ||
        state.phase == LabelScanPhase.scanning ||
        state.phase == LabelScanPhase.saving) {
      return;
    }

    final api = ref.read(apiClientProvider);
    state = state.copyWith(
      phase: LabelScanPhase.scanning,
      errorKey: () => null,
    );
    try {
      final json = await api.post<Map<String, dynamic>>(
        '/api/v1/nutrition-label/scan',
        {
          'imageBase64': base64EncodeLabelImage(image),
          'mimeType': image.mimeType,
        },
      );
      final label = NutritionLabel.fromJson(
        (json['label'] as Map<String, dynamic>?) ?? const {},
      );
      state = state.copyWith(
        phase: LabelScanPhase.review,
        label: () => label,
      );
    } catch (error) {
      state = state.copyWith(
        phase: LabelScanPhase.preview,
        errorKey: () => _errorKeyFor(error),
      );
    }
  }

  /// Skip the scan and edit an empty form — the escape hatch for a label the
  /// model can't read at all.
  void enterManualReview() {
    state = state.copyWith(
      phase: LabelScanPhase.review,
      label: () => null,
      errorKey: () => null,
    );
  }

  /// Stage + confirm the reviewed values in one call. Returns true on success
  /// (the sheet pops and toasts); on failure the review step stays put with an
  /// inline error so the user's edits aren't lost.
  Future<bool> logMeal({
    required String userId,
    required String date,
    required LabelReviewState review,
  }) async {
    if (state.phase == LabelScanPhase.saving || !review.canConfirm) {
      return false;
    }

    final api = ref.read(apiClientProvider);
    state = state.copyWith(phase: LabelScanPhase.saving, errorKey: () => null);
    try {
      await api.post<Map<String, dynamic>>('/api/v1/nutrition-label/log', {
        'productName': review.productName.trim(),
        'amount': review.parsedAmount,
        'unit': review.unit,
        'confidence': (state.label?.confidence ?? LabelConfidence.low).name,
        // Omit what the label never printed rather than send explicit nulls;
        // the contract's micronutrients are optional.
        for (final entry in review.nutrition.entries)
          if (entry.value != null) entry.key: entry.value,
        'mealId': _uuid.v4(),
        'loggedDate': date,
        'timezoneOffset': timezoneOffsetMinutes(),
      });
      invalidateMealSurfaces(ref.invalidate, userId, date);
      return true;
    } catch (error) {
      state = state.copyWith(
        phase: LabelScanPhase.review,
        errorKey: () => _errorKeyFor(error),
      );
      return false;
    }
  }

  /// Discard the current photo and shoot another.
  void retake() {
    state = state.copyWith(
      phase: LabelScanPhase.capture,
      image: () => null,
      label: () => null,
      errorKey: () => null,
    );
  }

  /// Back out of the review step to the photo it came from.
  void backToPreview() {
    state = state.copyWith(
      phase: state.image == null
          ? LabelScanPhase.capture
          : LabelScanPhase.preview,
      errorKey: () => null,
    );
  }
}

final labelScanProvider =
    AutoDisposeNotifierProvider<LabelScanController, LabelScanState>(
      LabelScanController.new,
    );
