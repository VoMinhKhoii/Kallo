import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/chrome/inline_nav_bar.dart';
import '../../../../shared/widgets/form/save_dock.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shared/widgets/surface/scroll_separator.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../onboarding/providers/onboarding_providers.dart';
import '../../data/step_save.dart';
import '../../logic/settings_spacing.dart';
import '../../logic/step_session.dart';
import '../profile/profile_status_views.dart';
import '../profile/settings_skeleton.dart';

/// What a step body gets from its page: the session it edits, the callback
/// the onboarding bodies call after every edit, and — for the one edit that
/// cannot wait for the button (the app language) — a save it can trigger.
typedef StepPageActions =
    ({StepSession session, VoidCallback changed, Future<void> Function() save});

/// A Settings page that IS an onboarding step: the step's own body, prefilled
/// from the saved profile, under the inline bar, with the [SaveDock] rising
/// only while something changed.
///
/// Settings used to keep its own editors for these fields — a form, custom
/// selects, a slider, instant-commit wrappers — which drifted from onboarding
/// and read like a web port. Now there is one set of controls: what the user
/// learned while setting up is what they meet when they come back to change
/// it. Onboarding owns the bodies; this owns the frame and the save.
class SettingsStepPage extends ConsumerStatefulWidget {
  const SettingsStepPage({
    super.key,
    required this.step,
    required this.title,
    required this.builder,
  });

  final SettingsStep step;

  /// The page's own title — the same words as the Settings row that opened it.
  final String title;

  final Widget Function(BuildContext context, StepPageActions actions) builder;

  @override
  ConsumerState<SettingsStepPage> createState() => _SettingsStepPageState();
}

class _SettingsStepPageState extends ConsumerState<SettingsStepPage> {
  /// Seeded ONCE, on the first profile to arrive: a save invalidates the
  /// profile, and re-seeding from the refetch would overwrite an edit made
  /// while it was in flight.
  StepSession? _session;
  bool _saving = false;

  @override
  void dispose() {
    _session?.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final session = _session;
    if (session == null || _saving) return;
    setState(() => _saving = true);
    try {
      final saved = await saveSettingsStep(ref, session);
      if (saved && mounted) {
        unawaited(showTopToast(context, tr('settings.saved')));
      }
    } catch (_) {
      if (mounted) {
        unawaited(
          showTopToast(
            context,
            tr('settings.profilePanel.saveError'),
            variant: TopToastVariant.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider);
    if (_session == null && profile.hasValue) {
      _session = StepSession.fromProfile(widget.step, profile.value);
    }
    final session = _session;

    return Screen(
      bottom: false,
      child: ScrollSeparator(
        header: Padding(
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp2),
          child: InlineNavBar(
            title: widget.title,
            parentTitle: tr('settings.title'),
          ),
        ),
        overlay:
            session == null
                ? null
                : ListenableBuilder(
                  listenable: session,
                  builder:
                      (context, _) => SaveDock(
                        visible: session.dirty,
                        enabled: session.canSave,
                        loading: _saving,
                        label: tr('settings.save'),
                        onPressed: _save,
                      ),
                ),
        child:
            session != null
                ? _body(session)
                : profile.hasError
                ? ProfileLoadError(
                  onRetry: () => ref.invalidate(profileProvider),
                )
                : const SettingsSkeleton(),
      ),
    );
  }

  Widget _body(StepSession session) {
    final padding = SettingsSpacing.rowList(context);
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: padding.copyWith(bottom: padding.bottom + SaveDock.clearance),
      child: ListenableBuilder(
        listenable: session,
        builder:
            (context, _) => widget.builder(context, (
              session: session,
              changed: session.changed,
              save: _save,
            )),
      ),
    );
  }
}
