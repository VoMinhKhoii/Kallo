/// CompactWeightLog — RN port of
/// `components/dashboard/compact-weight-log.tsx`.
///
/// A single-line weight logger: a decimal/comma-tolerant number input + a kg
/// suffix + a Save/Update submit. Prefills with today's logged weight (falling
/// back to the profile's current weight) and flips to "Update" once a value
/// exists for today. Success/error feedback is a transient inline line (no toast
/// host on mobile), and validation is a trivial inline numeric guard (30–300 kg).
library;

import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../shared/widgets/widgets.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/dashboard_providers.dart';
import 'dashboard_tokens.dart';

const double _weightMin = 30;
const double _weightMax = 300;

enum _FeedbackKind { success, error }

class _Feedback {
  const _Feedback(this.kind, this.message);
  final _FeedbackKind kind;
  final String message;
}

class CompactWeightLog extends ConsumerStatefulWidget {
  const CompactWeightLog({
    super.key,
    required this.currentWeight,
    required this.todayWeight,
    required this.todayDate,
    required this.args,
    this.autofocus = false,
    this.onSaved,
  });

  final double currentWeight;
  final double? todayWeight;
  final String todayDate;

  /// Dashboard key so the log mutation invalidates the right bundle.
  final DashboardArgs args;

  /// Focus the field on mount — used when hosted in a log sheet so the keypad
  /// opens immediately (no effect inline, where autofocus would be intrusive).
  final bool autofocus;

  /// Called after a successful save — the log sheet uses this to dismiss itself.
  final VoidCallback? onSaved;

  @override
  ConsumerState<CompactWeightLog> createState() => _CompactWeightLogState();
}

class _CompactWeightLogState extends ConsumerState<CompactWeightLog> {
  late final TextEditingController _controller =
      TextEditingController(text: _prefill);
  bool _dirty = false;
  String? _validationError;
  _Feedback? _feedback;
  bool _pending = false;
  bool _pressed = false;
  Timer? _feedbackTimer;
  late String _lastPrefill = _prefill;

  bool get _hasTodayWeight => widget.todayWeight != null;

  // String(todayWeight ?? currentWeight) — drop a trailing ".0".
  String get _prefill {
    final v = widget.todayWeight ?? widget.currentWeight;
    return v == v.truncateToDouble() ? v.truncate().toString() : v.toString();
  }

  @override
  void didUpdateWidget(CompactWeightLog oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Keep the field synced to incoming props ONLY while the user hasn't typed —
    // once dirty, prop changes must not clobber input (web's `if (!isDirty)`).
    final next = _prefill;
    if (next != _lastPrefill) {
      _lastPrefill = next;
      if (!_dirty) _controller.text = next;
    }
  }

  @override
  void dispose() {
    _feedbackTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _showFeedback(_Feedback? next) {
    _feedbackTimer?.cancel();
    setState(() => _feedback = next);
    if (next != null) {
      _feedbackTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _feedback = null);
      });
    }
  }

  void _onChanged(String _) {
    setState(() {
      _dirty = true;
      if (_validationError != null) _validationError = null;
    });
    if (_feedback != null) _showFeedback(null);
  }

  Future<void> _onSubmit() async {
    final weightKg = parseDecimalInput(_controller.text);
    if (weightKg.isNaN || weightKg < _weightMin || weightKg > _weightMax) {
      HapticFeedback.heavyImpact(); // warn: rejected input
      setState(() => _validationError = tr('dashboard.weightCard.invalid'));
      _showFeedback(
        _Feedback(_FeedbackKind.error, tr('dashboard.weightCard.invalidValue')),
      );
      return;
    }
    setState(() {
      _validationError = null;
      _pending = true;
    });

    try {
      await logWeight(
        ref,
        args: widget.args,
        loggedDate: widget.todayDate,
        weightKg: weightKg,
      );
      if (!mounted) return;
      // Stay populated with the submitted value; clear dirty so the prop-sync
      // (now fed the refetched todayWeight) takes over.
      final text =
          weightKg == weightKg.truncateToDouble() ? weightKg.truncate().toString() : weightKg.toString();
      setState(() {
        _controller.text = text;
        _dirty = false;
        _pending = false;
      });
      HapticFeedback.mediumImpact(); // success cue on save
      if (widget.onSaved != null) {
        widget.onSaved!(); // hosted in a sheet → dismiss; skip inline feedback
      } else {
        _showFeedback(
          _Feedback(_FeedbackKind.success, tr('dashboard.weightCard.saved')),
        );
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _pending = false);
      final message = error is ApiError
          ? error.message
          : tr('dashboard.weightCard.saveFailed');
      _showFeedback(_Feedback(_FeedbackKind.error, message));
    }
  }

  @override
  Widget build(BuildContext context) {
    final submitLabel = _pending
        ? tr('dashboard.saving')
        : _hasTodayWeight
            ? tr('dashboard.weightCard.update')
            : tr('dashboard.save');

    // Exactly one row-3 line shows: feedback wins, then validation, then hint.
    final showEditHint =
        _hasTodayWeight && _validationError == null && _feedback == null;

    final hasError = _validationError != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Always "Today's weight" — this field only ever logs today. No leading
        // icon: the label alone carries the meaning and reads cleaner.
        Padding(
          padding: const EdgeInsets.only(bottom: NhamSpacing.sp2),
          child: Text(
            tr('dashboard.weightCard.todaysWeight').toUpperCase(),
            style: dashEyebrow(),
          ),
        ),
        // Field on its own row, full width.
        TextField(
          controller: _controller,
          onChanged: _onChanged,
          enabled: !_pending,
          autofocus: widget.autofocus,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
          ],
          autocorrect: false,
          cursorColor: NhamColors.accent,
          // Substantial value type — a number entry reads as data, not body
          // copy.
          style: dashValue(color: kInk),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            // Soft warm fill instead of a hairline outline — the field reads as
            // a tappable surface, the way native mobile inputs do, and the
            // border only appears on focus / error.
            fillColor: hasError
                ? NhamColors.danger.withValues(alpha: 0.06)
                : kFieldFill,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp4,
              vertical: 15,
            ),
            // Suffix in-flow (no Positioned overlay → no overlap).
            suffixText: tr('dashboard.units.kg'),
            suffixStyle: dashMeta(color: kInkSecondary),
            border: _border(Colors.transparent),
            enabledBorder:
                _border(hasError ? NhamColors.danger : Colors.transparent),
            focusedBorder:
                _border(hasError ? NhamColors.danger : NhamColors.accent),
            disabledBorder: _border(Colors.transparent),
          ),
        ),
        const SizedBox(height: NhamSpacing.sp2),
        // Submit button beneath the field, full width — a clearer, more
        // thumb-friendly target than a cramped side-by-side button.
        SizedBox(
          width: double.infinity,
          child: _SubmitButton(
            label: submitLabel,
            pending: _pending,
            pressed: _pressed,
            onTapDown: () => setState(() => _pressed = true),
            onTapUp: () => setState(() => _pressed = false),
            onTapCancel: () => setState(() => _pressed = false),
            onTap: _pending ? null : _onSubmit,
          ),
        ),
        if (_feedback != null)
          Padding(
            padding: const EdgeInsets.only(top: NhamSpacing.sp2),
            child: Text(
              _feedback!.message,
              style: dashMeta(
                color: _feedback!.kind == _FeedbackKind.success
                    ? NhamColors.success
                    : NhamColors.danger,
              ),
            ),
          )
        else if (_validationError != null)
          Padding(
            padding: const EdgeInsets.only(top: NhamSpacing.sp2),
            child: Text(
              _validationError!,
              style: dashMeta(color: NhamColors.danger),
            ),
          )
        else if (showEditHint)
          Padding(
            padding: const EdgeInsets.only(top: NhamSpacing.sp2),
            child: Text(
              tr('dashboard.weightCard.editHint'),
              style: dashMeta(color: kInkDisabled),
            ),
          ),
      ],
    );
  }

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(NhamRadii.xl),
        borderSide: BorderSide(
          color: color,
          width: color == Colors.transparent ? 0 : 1.5,
        ),
      );
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({
    required this.label,
    required this.pending,
    required this.pressed,
    required this.onTapDown,
    required this.onTapUp,
    required this.onTapCancel,
    required this.onTap,
  });

  final String label;
  final bool pending;
  final bool pressed;
  final VoidCallback onTapDown;
  final VoidCallback onTapUp;
  final VoidCallback onTapCancel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: pending ? null : (_) => onTapDown(),
      onTapUp: pending ? null : (_) => onTapUp(),
      onTapCancel: pending ? null : onTapCancel,
      onTap: onTap,
      child: Opacity(
        opacity: pending ? 0.55 : 1,
        child: Container(
          // Stands on its own row now — own comfortable vertical height.
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp5,
            vertical: NhamSpacing.sp3,
          ),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: pressed && !pending ? NhamColors.btnHover : NhamColors.btn,
            borderRadius: BorderRadius.circular(NhamRadii.xl),
          ),
          child: pending
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : Text(
                  label,
                  // Sentence-case, body-sized label — a native button reads as
                  // a word, not a techy 11px all-caps eyebrow.
                  style: dashBody(color: Colors.white, weight: FontWeight.w600),
                ),
        ),
      ),
    );
  }
}
