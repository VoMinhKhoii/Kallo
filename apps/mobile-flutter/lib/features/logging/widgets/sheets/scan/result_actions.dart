import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../../services/billing/entitlement_state.dart';
import '../../../../../services/billing/feature_lock.dart';
import '../../../logic/scan/amount.dart';
import '../../../logic/scan/food.dart';
import '../../../logic/scan/log.dart';
import 'screen.dart';

const _uuid = Uuid();

/// What the scan screen does with a result: type a code, edit or type a food,
/// size it, add it. Holds the result's own state — the edited food, the
/// amount, the save in flight — which a fresh scan or a mode switch clears in
/// one place ([clearResult]).
mixin ScanResultActions on ConsumerState<ScanScreen> {
  bool typing = false;

  /// A food the user edited or typed — it wins over the scanned one.
  ScanFood? editedFood;
  ({ScanFood food, bool isNew})? editing;

  /// The amount chosen on the result. Held here, not in the result panel, so
  /// it survives an edit that leaves it meaningful ([carryAmount]).
  ScanAmount? amount;
  bool saving = false;
  String? saveError;

  /// One id per save — this food at this amount — reused across its retries:
  /// a save whose answer was lost comes back as saved on the retry, never as a
  /// second meal. A different food or amount is a different meal, and a new
  /// id, so a retry can never claim the old amount as the new one.
  String? _mealId;

  /// Premium actions (label scan, edit, typing a food) share one gate. Read
  /// in build, like every `premiumGate`; the tap is never null for an action.
  VoidCallback gated(VoidCallback action) =>
      premiumGate(ref, PremiumFeature.labelScan).tap(context, action)!;

  /// Forget the result — back to scanning, or into the other mode. Call it
  /// inside the caller's `setState`.
  void clearResult() {
    typing = false;
    editedFood = null;
    editing = null;
    amount = null;
    saveError = null;
    _mealId = null;
  }

  void startTyping() => setState(() => typing = true);

  void stopTyping() => setState(() => typing = false);

  void openEditor(ScanFood food, {required bool isNew}) =>
      setState(() => editing = (food: food, isNew: isNew));

  /// "Enter manually": a new food from nothing.
  void enterManually() => openEditor(ScanFood.blank(), isNew: true);

  void cancelEditing() => setState(() => editing = null);

  /// Done: the edited food replaces the scanned one — a different meal, so a
  /// fresh id — keeping the amount when it still means the same.
  void finishEditing(ScanFood food) => setState(() {
    final before = editing?.food;
    amount = before == null ? null : carryAmount(amount, before, food);
    editedFood = food;
    editing = null;
    saveError = null;
    _mealId = null;
  });

  /// A new amount is a new save, and a new id. Ignored mid-save: the amount
  /// being saved must not change under its own request.
  void setAmount(ScanAmount next) {
    if (saving) return;
    setState(() {
      amount = next;
      _mealId = null;
    });
  }

  /// Log [food] at [resolved] ([logScanFood] decides how) and close on
  /// success. The screen owns the spinner and the error for every path; a
  /// failure keeps the result, its amount and edits, so the retry is one tap.
  Future<void> add(ScanFood food, double resolved) async {
    // A second tap before the spinner's frame must not log the food twice.
    if (saving) return;
    setState(() {
      saving = true;
      saveError = null;
    });
    final result = await logScanFood(
      ref,
      purpose: widget.purpose,
      food: food,
      amount: resolved,
      userId: widget.userId,
      date: widget.date,
      mealId: _mealId ??= _uuid.v4(),
    );
    if (!mounted) return;
    final outcome = result.outcome;
    if (outcome != null) {
      Navigator.of(context).pop(outcome);
    } else {
      setState(() {
        saving = false;
        saveError = result.errorKey?.tr();
      });
    }
  }
}
