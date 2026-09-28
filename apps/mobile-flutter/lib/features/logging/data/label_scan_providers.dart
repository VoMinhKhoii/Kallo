/// Riverpod state for the nutrition-label branch of the scan screen: take (or
/// choose) a photo → `POST /api/v1/nutrition-label/scan` → the extracted
/// values as a result → `POST /api/v1/nutrition-label/log` ([logEntry], which
/// also logs an edited barcode product and a food typed by hand).
///
/// Kept separate from [barcodeFlowProvider] rather than merged into it: the
/// barcode controller is already covered end to end, and two small
/// controllers read better than one that branches on scan type. The sheet owns
/// the toggle between them.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../services/billing/feature_lock.dart';
import '../../../services/http/api_client.dart';
import '../../../models/nutrition_label.dart';
import '../logic/label/image.dart';
import '../logic/label/image_shrink.dart';
import '../logic/scan/food.dart';
import 'logging_keys.dart';
import 'logging_providers.dart';
import '../../../models/http/api_error.dart';

/// How the controller gets a photo. Behind a provider purely so tests can
/// stand in for the platform picker, which has no test surface of its own.
typedef LabelImageCapture =
    Future<LabelImageResult> Function(ImageSource source);

final labelImageCaptureProvider = Provider<LabelImageCapture>(
  (ref) => captureLabelImage,
);

/// Where the screen is in the capture → scan → review flow. Saving is the
/// result card's own state ([LabelScanController.logEntry] leaves this alone).
enum LabelScanPhase { capture, preview, scanning, review }

class LabelScanState {
  const LabelScanState({
    this.phase = LabelScanPhase.capture,
    this.image,
    this.label,
    this.labelImageId,
    this.errorKey,
  });

  final LabelScanPhase phase;

  /// The photo awaiting (or undergoing) a scan. Kept across a failed scan so
  /// "try this photo again" doesn't make the user shoot it twice.
  final LabelImage? image;

  final NutritionLabel? label;

  /// The server's id for the kept photo of this scan (`labelImageId` in the
  /// scan reply), passed back with the log request so the photo is linked to
  /// the saved meal. Null when the scan kept no photo or never ran.
  final String? labelImageId;

  /// l10n key for the current error (`logging.labelScan.error.*`), shown as an
  /// inline card. Null when no error.
  final String? errorKey;

  LabelScanState copyWith({
    LabelScanPhase? phase,
    LabelImage? Function()? image,
    NutritionLabel? Function()? label,
    String? Function()? labelImageId,
    String? Function()? errorKey,
  }) => LabelScanState(
    phase: phase ?? this.phase,
    image: image != null ? image() : this.image,
    label: label != null ? label() : this.label,
    labelImageId: labelImageId != null ? labelImageId() : this.labelImageId,
    errorKey: errorKey != null ? errorKey() : this.errorKey,
  );

  /// A failure before any read — a camera that would not open, a library
  /// photo that could not be used — which the camera stage says in words.
  String? get cameraProblemKey =>
      phase == LabelScanPhase.capture ? errorKey : null;

  /// The one error where switching to the barcode scanner is a better exit
  /// than reshooting the same wrong side of the package.
  bool get isNoLabelDetected =>
      errorKey == 'logging.labelScan.error.noLabelDetected';

  /// The server refused the scan as a premium feature (HTTP 402). The sheet
  /// sends the user to the paywall rather than offering a retry that cannot
  /// succeed.
  bool get isFeatureLocked =>
      errorKey == 'logging.labelScan.error.featureLocked';

  /// The server refused the scan for missing AI-processing consent (HTTP 403,
  /// App Store 5.1.2(i)). The sheet asks for consent rather than retrying.
  bool get isAiConsentRequired =>
      errorKey == 'logging.labelScan.error.aiConsentRequired';
}

/// Map an [ApiError] from the label endpoints onto a stable l10n key. The
/// server returns locale-agnostic codes; copy is resolved client-side so it
/// honors the app locale. Mirrors the barcode controller's `_errorKeyFor`.
String _errorKeyFor(Object error) {
  if (error is ApiError) {
    switch (error.code) {
      // Lowercase — the gate's code comes from the shared app-error catalog,
      // not from the OCR codes below it.
      case kFeatureLockedCode:
        return 'logging.labelScan.error.featureLocked';
      // Also lowercase and from the shared catalog: the photo would go to the
      // AI provider, and the user has not agreed to that.
      case 'ai_consent_required':
        return 'logging.labelScan.error.aiConsentRequired';
      case 'OCR_INVALID_IMAGE':
        return 'logging.labelScan.error.invalidImage';
      case 'OCR_NO_LABEL_DETECTED':
        return 'logging.labelScan.error.noLabelDetected';
      case 'OCR_RATE_LIMITED':
      // The scan route's own throttles, which pass through the OCR mapper
      // untouched so their Retry-After survives: RATE_LIMITED is the per-user
      // window or the app-wide daily budget, RATE_LIMITER_UNAVAILABLE is the
      // fail-closed 503 when the limiter cannot answer. Both mean "busy, try
      // again shortly", which is exactly what rateLimited already says; without
      // these arms they fell through to the generic serverError copy.
      case 'RATE_LIMITED':
      case 'RATE_LIMITER_UNAVAILABLE':
        return 'logging.labelScan.error.rateLimited';
      case 'VALIDATION_FAILED':
        return 'logging.labelScan.error.invalidImage';
      // The scan body now has a byte cap, so an oversized photo is a 413 rather
      // than a slow 400 — the same failure the client-side resize guards, and
      // the same copy it uses.
      case 'PAYLOAD_TOO_LARGE':
        return 'logging.labelScan.error.imageTooLarge';
    }
  }
  return 'logging.labelScan.error.serverError';
}

String _captureErrorKeyFor(LabelImageFailure failure) => switch (failure) {
  LabelImageFailure.permissionDenied =>
    'logging.labelScan.error.permissionDenied',
  // No dedicated copy: "Could not scan label. Please try again." is exactly
  // right for a camera that would not open or would not shoot, and the error
  // card's primary action already IS that retry.
  LabelImageFailure.cameraUnavailable => 'logging.labelScan.error.serverError',
  LabelImageFailure.tooLarge => 'logging.labelScan.error.imageTooLarge',
  LabelImageFailure.unsupported => 'logging.labelScan.error.invalidImage',
  // Backing out of the picker is not an error — handled before this is called.
  LabelImageFailure.cancelled => 'logging.labelScan.error.serverError',
};

/// One label session: capture, scan, and log, with a single-flight guard so
/// a double tap can't double-scan.
class LabelScanController extends AutoDisposeNotifier<LabelScanState> {
  @override
  LabelScanState build() => const LabelScanState();

  /// Take or choose a label photo. A cancelled picker leaves the state alone
  /// so the user lands back where they were.
  ///
  /// [isCurrent] is asked before the photo is committed: a photo from a
  /// camera session the screen has since left is dropped, not held or read.
  Future<void> pickImage(
    ImageSource source, {
    bool Function()? isCurrent,
  }) async {
    if (state.phase == LabelScanPhase.scanning) return;

    final result = await ref.read(labelImageCaptureProvider)(source);
    if (isCurrent?.call() == false) return;
    final failure = result.failure;
    if (failure == LabelImageFailure.cancelled) return;
    if (failure != null) {
      reportCaptureFailure(failure);
      return;
    }

    _hold(result);
  }

  /// Ingest a still the sheet's own live camera just wrote to disk.
  ///
  /// Divergence from [pickImage]: `image_picker` resizes to
  /// [labelImageMaxWidth] (1600px, q85) on the way out, while the live preview
  /// shoots at `ResolutionPreset.veryHigh` (~1080p) and is handed over as
  /// written — the preset is a target, not a byte guarantee. A still the size
  /// guard rejects is therefore shrunk to the picker's own rung and re-run
  /// ([shrinkLabelImageFile]) instead of being dropped as `tooLarge`.
  Future<void> captureFromFile(
    String path, {
    bool Function()? isCurrent,
  }) async {
    if (state.phase == LabelScanPhase.scanning) return;

    var result = await labelImageFromFile(path);
    if (result.failure == LabelImageFailure.tooLarge) {
      result = await shrinkLabelImageFile(path);
    }
    if (isCurrent?.call() == false) return;
    final failure = result.failure;
    if (failure == LabelImageFailure.cancelled) return;
    if (failure != null) {
      reportCaptureFailure(failure);
      return;
    }
    _hold(result);
  }

  /// A camera failure raised by the live preview itself (permission refused,
  /// no usable sensor, a shutter that threw). Lands on the capture phase with
  /// an error, which the camera stage shows in words.
  void reportCaptureFailure(LabelImageFailure failure) {
    if (failure == LabelImageFailure.cancelled) return;
    state = state.copyWith(
      phase: LabelScanPhase.capture,
      image: () => null,
      errorKey: () => _captureErrorKeyFor(failure),
    );
  }

  /// Hold a captured photo for review, clearing whatever the last attempt left.
  void _hold(LabelImageResult result) {
    state = state.copyWith(
      phase: LabelScanPhase.preview,
      image: () => result.image,
      label: () => null,
      labelImageId: () => null,
      errorKey: () => null,
    );
  }

  /// Send the held photo to the vision model. On failure the photo is kept so
  /// a retry is one tap away.
  Future<void> scan() async {
    final image = state.image;
    if (image == null || state.phase == LabelScanPhase.scanning) return;

    final api = ref.read(apiClientProvider);
    state = state.copyWith(
      phase: LabelScanPhase.scanning,
      labelImageId: () => null,
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
        labelImageId: () => json['labelImageId'] as String?,
      );
    } catch (error) {
      state = state.copyWith(
        phase: LabelScanPhase.preview,
        errorKey: () => _errorKeyFor(error),
      );
    }
  }

  /// Log a food confirmed on the scan result — a read label, a barcode
  /// product the user edited, or one typed by hand — at [amount] (in the
  /// food's unit): stage + confirm in one call, no pending card.
  ///
  /// Returns null once the meal is written, else the error key to show. It
  /// does NOT move [state]: the result card owns its saving spinner and keeps
  /// the amount and edits on a failure, so the retry is one tap away.
  ///
  /// Premium: the endpoint is behind `label_scan`, so free accounts reach this
  /// only after the paywall (the owner's ruling, 2026-09-28).
  ///
  /// [mealId] is the result's own, kept across its retries ([isMealAlreadySaved]).
  Future<String?> logEntry({
    required String userId,
    required String date,
    required ScanFood food,
    required double amount,
    required String mealId,
  }) async {
    if (!food.hasRequired || amount <= 0 || food.name.trim().isEmpty) {
      return 'logging.scan.missingValues';
    }
    final api = ref.read(apiClientProvider);
    try {
      await api.post<Map<String, dynamic>>('/api/v1/nutrition-label/log', {
        'productName': food.name.trim(),
        'amount': amount,
        'unit': food.unit,
        'confidence': (food.confidence ?? LabelConfidence.low).name,
        for (final entry in food.nutritionFor(amount).entries)
          if (entry.value != null) entry.key: entry.value,
        'mealId': mealId,
        // Only a read label has a kept photo to link.
        if (food.source == ScanFoodSource.label && state.labelImageId != null)
          'labelImageId': state.labelImageId,
        'loggedDate': date,
        'timezoneOffset': timezoneOffsetMinutes(),
      });
    } catch (error) {
      if (!isMealAlreadySaved(error)) return _errorKeyFor(error);
    }
    // The meal COMMITTED the moment the POST returned, so nothing below may
    // turn a saved meal into a failed save — [settleAfterMealWrite] sits
    // outside the try that owns the return value and never throws.
    await settleAfterMealWrite(
      ref.read,
      ref.invalidate,
      userId: userId,
      date: date,
      // The day is refreshed by the helper; re-invalidating it here would throw
      // that result away and put the refetch back after the pin.
      also:
          () => invalidateMealSurfaces(
            ref.invalidate,
            userId,
            date,
            includeDay: false,
          ),
    );
    return null;
  }

  /// Discard the current photo and shoot another.
  void retake() {
    state = state.copyWith(
      phase: LabelScanPhase.capture,
      image: () => null,
      label: () => null,
      labelImageId: () => null,
      errorKey: () => null,
    );
  }
}

final labelScanProvider =
    AutoDisposeNotifierProvider<LabelScanController, LabelScanState>(
      LabelScanController.new,
    );
