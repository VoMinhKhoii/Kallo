import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/profile_providers.dart';
import '../../logic/profile_payload.dart';
import 'profile_form_controller.dart';
import 'profile_form_values.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// A focused settings editor for non-numeric preferences (cooking habits,
/// region & language). Toggle/select changes instant-commit — the moment a
/// value diverges, the full profile payload is re-saved (targets recomputed
/// from the unchanged body metrics) and a success haptic fires. No save bar:
/// per the audit, the bar is reserved for the numeric goal editor.
///
/// Seeds its own [ProfileFormController] from [profile] and exposes it to the
/// [child] panel via a [ProfileFormScope], so the existing panels (which read
/// `ProfileFormController.of(context)`) drop in unchanged.
class InstantCommitEditor extends ConsumerStatefulWidget {
  const InstantCommitEditor({
    super.key,
    required this.profile,
    this.subtitle,
    required this.child,
  });

  final ProfileRow profile;

  /// The description line under the header bar, or null when the header's
  /// title already says everything (Region & language, 2026-09-03). The
  /// screen's TITLE is not this widget's business — it lives in the shared
  /// page header.
  final String? subtitle;
  final Widget child;

  @override
  ConsumerState<InstantCommitEditor> createState() =>
      _InstantCommitEditorState();
}

class _InstantCommitEditorState extends ConsumerState<InstantCommitEditor> {
  late final ProfileFormController _controller = ProfileFormController(
    ProfileFormValues.fromRow(widget.profile),
  );
  String? _errorText;

  /// The app locale at the last successful save. A locale change is committed
  /// even when no form field is dirty (preferredLocale lives outside the form).
  late String _savedLocale =
      widget.profile.raw['preferredLocale'] as String? ??
      WidgetsBinding.instance.platformDispatcher.locale.languageCode;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onChanged);
    _controller.dispose();
    super.dispose();
  }

  /// Guards against the markSaved()-notifies-listeners feedback loop: while a
  /// commit is settling we ignore the controller notifications it triggers.
  bool _committing = false;

  void _onChanged() {
    setState(() {});
    // A controller notification only fires on a user edit (the panels and the
    // language row both notify on change) — never on mount — so each genuine
    // edit instant-commits. markSaved() inside _commit() re-notifies; _committing
    // suppresses that so we don't loop.
    if (_committing) return;
    final localeChanged = context.locale.languageCode != _savedLocale;
    if (_controller.isDirty || localeChanged) _commit();
  }

  /// The values/locale of a failed commit, held for the retry affordance
  /// (the visible controls roll back to the last-saved state on failure).
  ProfileFormValues? _failedValues;
  String? _failedLocale;

  Future<void> _commit() async {
    final locale = context.locale.languageCode;
    // Instant-commit requires complete body metrics (an onboarded profile). The
    // editors are only reachable for such a profile, but guard anyway so a
    // partial profile never PUTs nulls.
    if (validateBodyMetrics(_controller.values).isNotEmpty) {
      // Nothing was sent — don't let a device-side locale change diverge from
      // the server; revert it and say quietly why nothing saved.
      if (locale != _savedLocale) {
        await context.setLocale(Locale(_savedLocale));
      }
      if (mounted) {
        setState(() => _errorText = tr('settings.profilePanel.incompleteHint'));
      }
      return;
    }

    _committing = true;
    final committed = _controller.values.clone();
    final payload = buildProfilePayload(committed, locale);
    final ok = await ref.read(saveProfileProvider.notifier).save(payload);
    if (!mounted) {
      _committing = false;
      return;
    }
    if (ok) {
      // One save-success cue app-wide: mediumImpact (matches logging + the
      // goal editor), not the lighter selection tick.
      HapticFeedback.mediumImpact();
      // Baseline exactly what was sent — edits made while the save was in
      // flight stay dirty and re-commit below, instead of being silently
      // baselined away.
      _controller.markSavedAs(committed);
      _savedLocale = locale;
      _failedValues = null;
      _failedLocale = null;
      if (_errorText != null) setState(() => _errorText = null);
      _committing = false;
      if (_controller.isDirty || context.locale.languageCode != _savedLocale) {
        await _commit();
      }
    } else {
      // Visual rollback: the controls return to their last-saved values, and a
      // device-side locale change is reverted so device and server never
      // diverge. The attempted values are held for "Try again".
      _failedValues = _controller.values.clone();
      _failedLocale = locale;
      _controller.reset();
      if (context.locale.languageCode != _savedLocale) {
        await context.setLocale(Locale(_savedLocale));
      }
      if (mounted) {
        setState(() => _errorText = tr('settings.profilePanel.saveError'));
      }
      _committing = false;
    }
  }

  /// Re-applies the failed commit's values (and locale) and commits again.
  Future<void> _retry() async {
    final values = _failedValues;
    if (values == null) return;
    final locale = _failedLocale;
    _failedValues = null;
    _failedLocale = null;
    setState(() => _errorText = null);
    if (locale != null && locale != context.locale.languageCode) {
      await context.setLocale(Locale(locale));
      if (!mounted) return;
    }
    // setValues notifies; _onChanged sees the dirty/locale state and commits.
    _controller.setValues(values);
  }

  @override
  Widget build(BuildContext context) {
    return ProfileFormScope(
      controller: _controller,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          KalloSpacing.sp3, // the app-wide 12 content inset
          KalloSpacing.sp2,
          KalloSpacing.sp3,
          KalloSpacing.sp8,
        ),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          // No title here — it lives in the header bar. This is the subtitle
          // that used to sit under it, and only when it adds something.
          if (widget.subtitle case final subtitle?)
            Padding(
              padding: const EdgeInsets.only(bottom: KalloSpacing.sp4),
              child: Text(subtitle, style: dashMeta()),
            ),
          if (_errorText != null)
            Padding(
              padding: const EdgeInsets.only(bottom: KalloSpacing.sp3),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      _errorText!,
                      style: dashBody(color: KalloColors.danger),
                    ),
                  ),
                  if (_failedValues != null) ...[
                    const SizedBox(width: KalloSpacing.sp3),
                    Semantics(
                      button: true,
                      excludeSemantics: true,
                      label: tr('settings.profilePanel.retry'),
                      onTap: _retry,
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _retry,
                        child: Text(
                          tr('settings.profilePanel.retry'),
                          style: dashBody(),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          widget.child,
        ],
      ),
    );
  }
}
