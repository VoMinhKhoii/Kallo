import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/profile_providers.dart';
import '../logic/profile_payload.dart';
import 'profile_form_controller.dart';
import 'profile_form_values.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

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
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final ProfileRow profile;
  final String title;
  final String subtitle;
  final Widget child;

  @override
  ConsumerState<InstantCommitEditor> createState() =>
      _InstantCommitEditorState();
}

class _InstantCommitEditorState extends ConsumerState<InstantCommitEditor> {
  late final ProfileFormController _controller =
      ProfileFormController(ProfileFormValues.fromRow(widget.profile));
  String? _errorText;

  /// The app locale at the last successful save. A locale change is committed
  /// even when no form field is dirty (preferredLocale lives outside the form).
  late String _savedLocale = widget.profile.raw['preferredLocale'] as String? ??
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

  Future<void> _commit() async {
    final v = _controller.values;
    // Instant-commit requires complete body metrics (an onboarded profile). The
    // editors are only reachable for such a profile, but guard anyway so a
    // partial profile never PUTs nulls.
    if (validateBodyMetrics(v).isNotEmpty) return;

    _committing = true;
    final locale = context.locale.languageCode;
    final payload = buildProfilePayload(v, locale);
    final ok = await ref.read(saveProfileProvider.notifier).save(payload);
    if (!mounted) {
      _committing = false;
      return;
    }
    if (ok) {
      HapticFeedback.selectionClick();
      _controller.markSaved();
      _savedLocale = locale;
      if (_errorText != null) setState(() => _errorText = null);
    } else {
      setState(() => _errorText = tr('settings.profilePanel.saveError'));
    }
    _committing = false;
  }

  @override
  Widget build(BuildContext context) {
    return ProfileFormScope(
      controller: _controller,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          NhamSpacing.sp4,
          NhamSpacing.sp2,
          NhamSpacing.sp4,
          NhamSpacing.sp8,
        ),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          Text(
            widget.title,
            style: NhamTextStyles.serifRegular(fontSize: NhamFontSize.h3)
                .copyWith(
                    letterSpacing: NhamTracking.tight, color: NhamColors.text),
          ),
          const SizedBox(height: NhamSpacing.sp1),
          Padding(
            padding: const EdgeInsets.only(bottom: NhamSpacing.sp4),
            child: Text(
              widget.subtitle,
              style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.detail)
                  .copyWith(height: 20 / 13, color: NhamColors.textWarm),
            ),
          ),
          if (_errorText != null)
            Padding(
              padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
              child: Text(
                _errorText!,
                style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.sm)
                    .copyWith(color: NhamColors.danger),
              ),
            ),
          widget.child,
        ],
      ),
    );
  }
}
