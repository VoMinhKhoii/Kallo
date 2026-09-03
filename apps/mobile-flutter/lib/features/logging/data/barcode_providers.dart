/// Riverpod state for the barcode-scanning sheet: scan (or type) a barcode →
/// `GET /api/v1/barcode/search` → quantity step → `POST /api/v1/barcode/log`
/// (stage + confirm in one server-side call — no pending card).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../services/billing/feature_lock.dart';
import '../../../services/http/api_client.dart';
import '../../../models/nutrition/barcode_product.dart';
import 'logging_keys.dart';
import 'logging_providers.dart';

const _uuid = Uuid();

/// Where the sheet is in the scan → search → quantity → save flow.
enum BarcodeFlowPhase { scanning, manualEntry, searching, product, saving }

class BarcodeFlowState {
  final BarcodeFlowPhase phase;
  final BarcodeProduct? product;

  /// l10n key for the current error (`logging.barcode.error.*`), shown as an
  /// inline card in place of the camera/manual input. Null when no error.
  final String? errorKey;

  /// The last barcode we searched — kept for the error card's context line.
  final String? lastBarcode;

  /// The code whose failed lookup is currently on screen. A scan that keeps
  /// landing on it is the SAME miss, not a new one, so it is dropped instead
  /// of re-searching: `DetectionSpeed.noDuplicates` is a no-op on iOS, and the
  /// sheet re-arms its own decode guard every time the phase returns to
  /// `scanning` — which the catch block below does on every failure. Pointing
  /// at one unknown package therefore searched it forever.
  ///
  /// Cleared by success, [BarcodeFlowController.scanAgain] and
  /// [BarcodeFlowController.enterManualMode]; bypassed by `search(force:
  /// true)`, which is what a deliberate manual submit passes.
  final String? blockedBarcode;

  const BarcodeFlowState({
    this.phase = BarcodeFlowPhase.scanning,
    this.product,
    this.errorKey,
    this.lastBarcode,
    this.blockedBarcode,
  });

  BarcodeFlowState copyWith({
    BarcodeFlowPhase? phase,
    BarcodeProduct? Function()? product,
    String? Function()? errorKey,
    String? lastBarcode,
    String? Function()? blockedBarcode,
  }) => BarcodeFlowState(
    phase: phase ?? this.phase,
    product: product != null ? product() : this.product,
    errorKey: errorKey != null ? errorKey() : this.errorKey,
    lastBarcode: lastBarcode ?? this.lastBarcode,
    blockedBarcode:
        blockedBarcode != null ? blockedBarcode() : this.blockedBarcode,
  );

  /// Not-found is the one error where "describe it instead" (the AI composer)
  /// is a better exit than rescanning the same unknown product.
  bool get isNotFound => errorKey == 'logging.barcode.error.notFound';
}

/// Map an [ApiError] from the barcode endpoints onto a stable l10n key. The
/// server returns locale-agnostic codes; copy is resolved client-side so it
/// honors the app locale.
String _errorKeyFor(Object error) {
  if (error is ApiError) {
    switch (error.code) {
      // Mirrored from the label controller — kept in sync with it. Lowercase:
      // the gate's code comes from the shared app-error catalog.
      case kFeatureLockedCode:
        return 'logging.barcode.error.featureLocked';
      case 'BARCODE_NOT_FOUND':
        return 'logging.barcode.error.notFound';
      case 'BARCODE_NOT_CACHED':
        return 'logging.barcode.error.notCached';
      case 'VALIDATION_FAILED':
        return 'logging.barcode.error.invalidInput';
    }
  }
  return 'logging.barcode.error.serverError';
}

/// One barcode-sheet session: search + log, with single-flight guards so a
/// burst of decode callbacks (or double taps) can't double-search or
/// double-log.
class BarcodeFlowController extends AutoDisposeNotifier<BarcodeFlowState> {
  @override
  BarcodeFlowState build() => const BarcodeFlowState();

  /// Look up a scanned or typed barcode. Non-digits are stripped client-side
  /// (EAN/UPC decoders and keyboards both occasionally sneak separators in);
  /// an empty result surfaces as invalid input without a round trip.
  ///
  /// A code whose failure is still on screen is dropped — see
  /// [BarcodeFlowState.blockedBarcode]. [force] is the deliberate retry: the
  /// user typed (or re-typed) this code and pressed look up.
  Future<void> search(String rawBarcode, {bool force = false}) async {
    if (state.phase == BarcodeFlowPhase.searching ||
        state.phase == BarcodeFlowPhase.saving) {
      return;
    }

    final code = rawBarcode.replaceAll(RegExp(r'\D'), '');
    if (code.isEmpty) {
      state = state.copyWith(
        errorKey: () => 'logging.barcode.error.invalidInput',
      );
      return;
    }

    // The camera is still pointed at the package we just failed on. Re-running
    // the same lookup would only redraw the same miss.
    if (!force && code == state.blockedBarcode && state.errorKey != null) {
      return;
    }

    final api = ref.read(apiClientProvider);
    state = state.copyWith(
      phase: BarcodeFlowPhase.searching,
      errorKey: () => null,
      lastBarcode: code,
    );
    try {
      final json = await api.get<Map<String, dynamic>>(
        '/api/v1/barcode/search?code=${Uri.encodeQueryComponent(code)}',
      );
      final product = BarcodeProduct.fromJson(
        (json['product'] as Map<String, dynamic>?) ?? const {},
      );
      state = state.copyWith(
        phase: BarcodeFlowPhase.product,
        product: () => product,
        blockedBarcode: () => null,
      );
    } catch (error) {
      // Back to the scanner phase with the miss reported inside the frame, and
      // this code blocked so the live camera cannot re-search it on the very
      // next frame — resumable via scanAgain() or a forced manual submit.
      state = state.copyWith(
        phase: BarcodeFlowPhase.scanning,
        errorKey: () => _errorKeyFor(error),
        blockedBarcode: () => code,
      );
    }
  }

  /// Stage + confirm the current product at [grams] in one call. Returns true
  /// on success (the sheet pops and toasts); on failure the quantity step
  /// stays put with an inline error so the chosen amount isn't lost.
  Future<bool> logMeal({
    required String userId,
    required String date,
    required int grams,
  }) async {
    final product = state.product;
    if (product == null || state.phase == BarcodeFlowPhase.saving) return false;

    final api = ref.read(apiClientProvider);
    state = state.copyWith(
      phase: BarcodeFlowPhase.saving,
      errorKey: () => null,
    );
    try {
      await api.post<Map<String, dynamic>>('/api/v1/barcode/log', {
        'barcode': product.barcode,
        'grams': grams,
        'mealId': _uuid.v4(),
        'loggedDate': date,
        'timezoneOffset': timezoneOffsetMinutes(),
      });
      invalidateMealSurfaces(ref.invalidate, userId, date);
      return true;
    } catch (error) {
      final key = _errorKeyFor(error);
      // A purged cache row (not_cached) can only be repaired by re-searching;
      // send the user back to the scanner. Anything else keeps the quantity
      // step (and the chosen amount) so a transient failure is one tap away
      // from a retry.
      state = state.copyWith(
        phase:
            key == 'logging.barcode.error.notCached'
                ? BarcodeFlowPhase.scanning
                : BarcodeFlowPhase.product,
        errorKey: () => key,
      );
      return false;
    }
  }

  /// Resume scanning after an error or from the quantity step's back link.
  void scanAgain() {
    state = state.copyWith(
      phase: BarcodeFlowPhase.scanning,
      product: () => null,
      errorKey: () => null,
      blockedBarcode: () => null,
    );
  }

  /// Switch to typing the barcode (camera unavailable, damaged code, …).
  void enterManualMode() {
    state = state.copyWith(
      phase: BarcodeFlowPhase.manualEntry,
      product: () => null,
      errorKey: () => null,
      blockedBarcode: () => null,
    );
  }
}

final barcodeFlowProvider =
    AutoDisposeNotifierProvider<BarcodeFlowController, BarcodeFlowState>(
      BarcodeFlowController.new,
    );
