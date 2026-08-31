import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../services/billing/feature_lock.dart';
import '../../../data/label_scan_providers.dart';
import '../../../logic/label/review.dart';
import '../../../logic/meal_log_mode.dart';
import '../../../../../models/nutrition_label.dart';
import 'label_capture_step.dart';
import 'review/label_review_step.dart';
import '../scan/scan_error_card.dart';

/// The nutrition-label branch of the scan sheet: photograph the printed table,
/// have it read, check the values, log the meal.
///
/// The surrounding chrome (surface, header, saving lock, scan-type toggle)
/// belongs to `scan_sheet.dart`; this is only the body. It pops the sheet with
/// `true` once a meal is saved.
class LabelScanBranch extends ConsumerStatefulWidget {
  const LabelScanBranch({
    super.key,
    required this.userId,
    required this.date,
    required this.onScanBarcodeInstead,
  });

  final String userId;
  final String date;

  /// A package whose table we can't read still has a barcode on it — this
  /// switches the host to the other branch.
  final VoidCallback onScanBarcodeInstead;

  @override
  ConsumerState<LabelScanBranch> createState() => _LabelScanBranchState();
}

class _LabelScanBranchState extends ConsumerState<LabelScanBranch> {
  LabelReviewState? _review;

  /// The label [_review] was seeded from. A new scan produces a new instance,
  /// which is how a second scan re-seeds the form instead of keeping the
  /// previous product's numbers. Manual entry seeds from null, so the flag
  /// below distinguishes "seeded from nothing" from "not seeded yet".
  NutritionLabel? _reviewSeed;
  bool _reviewSeeded = false;

  LabelReviewState _reviewFor(NutritionLabel? label) {
    if (!_reviewSeeded || !identical(_reviewSeed, label)) {
      _review = LabelReviewState(
        label,
        defaultProductName: 'logging.labelScan.defaultProductName'.tr(),
      );
      _reviewSeed = label;
      _reviewSeeded = true;
    }
    return _review!;
  }

  void _dropReview() {
    _review = null;
    _reviewSeed = null;
    _reviewSeeded = false;
  }

  Future<void> _confirm() async {
    final review = _review;
    if (review == null) return;
    final saved = await ref
        .read(labelScanProvider.notifier)
        .logMeal(userId: widget.userId, date: widget.date, review: review);
    if (saved && mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    // The controller maps the server's 402 onto an error key rather than
    // rethrowing, so the paywall hop happens here — the first place with a
    // BuildContext. Same destination as `handledFeatureLock`.
    ref.listen<LabelScanState>(labelScanProvider, (prev, next) {
      if (next.isFeatureLocked && !(prev?.isFeatureLocked ?? false)) {
        openPaywall(context);
      }
    });

    final state = ref.watch(labelScanProvider);
    final notifier = ref.read(labelScanProvider.notifier);

    // An error outside the review step replaces the body: there is nothing
    // useful behind it, and the recovery actions are the whole point.
    if (state.errorKey != null &&
        state.phase != LabelScanPhase.review &&
        state.phase != LabelScanPhase.saving) {
      return _errorCard(state, notifier);
    }

    switch (state.phase) {
      case LabelScanPhase.capture:
      case LabelScanPhase.preview:
      case LabelScanPhase.scanning:
        return LabelCaptureStep(
          image: state.image,
          scanning: state.phase == LabelScanPhase.scanning,
          onPick: notifier.pickImage,
          onScan: notifier.scan,
          onRetake: notifier.retake,
          onManualEntry: _enterManualReview,
        );
      case LabelScanPhase.review:
      case LabelScanPhase.saving:
        final review = _reviewFor(state.label);
        return LabelReviewStep(
          // Keyed per review so the text controllers re-seed on a second scan
          // instead of holding the previous product's numbers — the same
          // guard the barcode step applies with `ValueKey(product.barcode)`.
          key: ObjectKey(review),
          review: review,
          saving: state.phase == LabelScanPhase.saving,
          errorText: state.errorKey?.tr(),
          onBack: () {
            _dropReview();
            notifier.backToPreview();
          },
          onConfirm: _confirm,
        );
    }
  }

  void _enterManualReview() {
    _dropReview();
    ref.read(labelScanProvider.notifier).enterManualReview();
  }

  Widget _errorCard(LabelScanState state, LabelScanController notifier) {
    final hasPhoto = state.image != null;
    return ScanErrorCard(
      icon: LucideIcons.scanText300,
      message: state.errorKey!.tr(),
      primary: ScanErrorAction(
        label:
            hasPhoto
                ? 'logging.labelScan.retryPhoto'.tr()
                : 'logging.labelScan.takePhoto'.tr(),
        onTap: hasPhoto ? notifier.scan : notifier.retake,
      ),
      secondary: [
        if (state.isNoLabelDetected)
          ScanErrorAction(
            icon: LucideIcons.scanBarcode300,
            label: 'logging.scan.tryBarcodeInstead'.tr(),
            onTap: widget.onScanBarcodeInstead,
          ),
        if (hasPhoto)
          ScanErrorAction(
            icon: LucideIcons.rotateCcw300,
            label: 'logging.labelScan.retake'.tr(),
            onTap: notifier.retake,
          ),
      ],
      quiet:
          isManualNutritionEntryOffered
              ? ScanErrorAction(
                icon: LucideIcons.keyboard300,
                label: 'logging.labelScan.manualEntry'.tr(),
                onTap: _enterManualReview,
              )
              : null,
    );
  }
}
