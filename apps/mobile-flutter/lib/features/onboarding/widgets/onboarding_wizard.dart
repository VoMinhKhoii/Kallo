import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../data/constants.dart';
import '../data/onboarding_draft.dart';
import '../data/profile_row.dart';
import '../logic/onboarding_answers.dart';
import '../logic/onboarding_seed.dart';
import '../logic/region_defaults.dart';
import '../providers/onboarding_draft_providers.dart';
import '../providers/onboarding_providers.dart';
import '../screens/step_about_you.dart';
import '../screens/step_cooking.dart';
import '../screens/step_goal.dart';
import '../screens/step_language.dart';
import '../screens/step_origin.dart';
import '../screens/step_target.dart';
import 'onboarding_step_scaffold.dart';

/// The six-screen onboarding wizard — presentation-agnostic; the caller wraps
/// it ([OnboardingScreen] full page, [showOnboardingDialog] modal).
///
/// It owns ALL the answers ([OnboardingAnswers]) and which screen is showing;
/// the screens themselves are stateless views that mutate that one object and
/// call back. [onComplete] fires once the last screen saves; [onClose] backs
/// out of screen 1 (null hides the back chevron there — mandatory mode).
///
/// **Screens are not server steps.** The server keeps three; the wizard shows
/// six, and only four of them post on the way out — screen 2 (step 1), 4 and 6
/// (step 2, twice, so a user who leaves after the goal still has a target), and
/// 5 (step 3). Screens 1 and 3 collect half a step each and only move the
/// draft's progress marker. See `logic/resume_screen.dart` for the way back.
class OnboardingWizard extends ConsumerStatefulWidget {
  const OnboardingWizard({
    super.key,
    required this.onComplete,
    required this.onClose,
  });

  final VoidCallback onComplete;
  final VoidCallback? onClose;

  @override
  ConsumerState<OnboardingWizard> createState() => _OnboardingWizardState();
}

const Map<int, String> _titles = {
  1: 'onboarding.language.title',
  2: 'onboarding.origin.stepTitle',
  3: 'onboarding.aboutYou.title',
  4: 'onboarding.goal.title',
  5: 'onboarding.cooking.title',
  6: 'onboarding.target.title',
};

class _OnboardingWizardState extends ConsumerState<OnboardingWizard> {
  int? _screen;
  OnboardingAnswers? _answers;
  OnboardingDeviceHints? _device;
  bool _busy = false;
  bool _reportedSeedError = false;

  /// Resolved ONCE, the first time every source has settled, and never again:
  /// a later re-read would overwrite answers the user is in the middle of
  /// giving (every save invalidates `profileProvider`, so there IS a later
  /// read).
  void _resolveStart(ProfileRow? profile, OnboardingDraft? draft) {
    final seeded = buildOnboardingAnswers(
      profile: profile,
      draft: draft,
      deviceRegion: deviceRegionCode(),
      deviceLanguage: deviceLanguageCode(),
    );
    _answers = seeded.answers;
    _device = seeded.device;
    _screen = ref.read(onboardingResumeScreenProvider);
  }

  /// The server step this screen posts on its way out, or null when it posts
  /// nothing (a half-step screen, or a step-2 screen with no metrics yet).
  OnboardingStepPayload? _payload(int screen) {
    final answers = _answers!;
    switch (screen) {
      case 2:
        return (step: 1, data: answers.stepOnePayload);
      case 4:
      case 6:
        final values = answers.stepTwoValues;
        return values == null ? null : (step: 2, data: values.toJson());
      case 5:
        return (step: 3, data: answers.stepThreePayload);
      default:
        return null;
    }
  }

  Future<void> _leave(int screen, {required bool skip}) async {
    final sink = ref.read(onboardingSinkProvider);
    setState(() => _busy = true);
    try {
      await sink.record(
        screen: screen,
        payload: skip ? null : _payload(screen),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      showTopToast(
        context,
        tr('onboarding.saveError'),
        variant: TopToastVariant.error,
      );
      return;
    }
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (screen < kOnboardingScreenCount) _screen = screen + 1;
    });
    if (screen >= kOnboardingScreenCount) widget.onComplete();
  }

  void _back(int screen) {
    if (screen <= 1) return widget.onClose?.call();
    setState(() => _screen = screen - 1);
  }

  /// Whether every source the seed reads has ANSWERED.
  ///
  /// Seeding off a source that has not landed yet would open the wizard blank
  /// for a signed-out user whose draft is still coming off disk — and the seed
  /// is resolved once, so "blank" would stick for the whole session.
  ///
  /// The SESSION is one of those sources even though the seed never reads it.
  /// `profileProvider` answers `AsyncData(null)` immediately while signed out,
  /// and it is asked before Supabase's restored session arrives — so without
  /// this a signed-in user seeded off "no profile", and screen 2 then posted
  /// the phone's country guess over the country they had actually saved.
  ///
  /// For a signed-in user the profile must have LANDED — a value, and not an
  /// error. An ERRORED fetch is not loading, and Riverpod hands the error the
  /// PREVIOUS value alongside it: that previous value is the `null` the
  /// provider answered with while the session was still unrestored, so waiting
  /// on `!isLoading` (or on `hasValue`) alone let a failed fetch seed a
  /// signed-in user from the device exactly as an unrestored session did — and
  /// screen 2 then posted the phone's country over their saved one.
  bool _settled({
    required bool signedIn,
    required AsyncValue<Object?> session,
    required AsyncValue<Object?> profile,
    required AsyncValue<Object?> draft,
  }) {
    if (session.isLoading || draft.isLoading || profile.isLoading) return false;
    return !signedIn || (profile.hasValue && !profile.hasError);
  }

  /// A profile that will not load is a dead end for the seed, so say so once
  /// and offer the only move that helps: ask for it again.
  void _reportSeedError() {
    if (_reportedSeedError) return;
    _reportedSeedError = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      showTopToast(
        context,
        tr('onboarding.saveError'),
        variant: TopToastVariant.error,
        actionLabel: tr('common.retry'),
        onAction: () {
          _reportedSeedError = false;
          ref.invalidate(profileProvider);
        },
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final profile = ref.watch(profileProvider);
    final draft = ref.watch(onboardingDraftProvider);

    if (_answers == null) {
      final signedIn = ref.watch(currentSessionProvider) != null;
      if (!_settled(
        signedIn: signedIn,
        session: session,
        profile: profile,
        draft: draft,
      )) {
        if (signedIn && profile.hasError) _reportSeedError();
        return const ColoredBox(color: kPage);
      }
      _resolveStart(profile.valueOrNull, draft.valueOrNull);
    }

    final screen = _screen!;
    final last = screen >= kOnboardingScreenCount;
    final blocked = _busy || (screen == 3 && !_answers!.metricsValid);

    return OnboardingStepScaffold(
      // Keyed by screen: each one gets a fresh scroll position and fresh field
      // controllers instead of inheriting the last screen's.
      key: ValueKey(screen),
      screen: screen,
      title: tr(_titles[screen]!),
      ctaLabel:
          tr(last ? 'onboarding.savePlan' : 'onboarding.continueLabel'),
      busy: _busy,
      onContinue: blocked ? null : () => _leave(screen, skip: false),
      onBack: screen == 1 && widget.onClose == null
          ? null
          : (_busy ? null : () => _back(screen)),
      onSkip: screen == 1 || _busy ? null : () => _leave(screen, skip: true),
      child: _body(screen),
    );
  }

  Widget _body(int screen) {
    final answers = _answers!;
    final device = _device!;
    void changed() => setState(() {});
    return switch (screen) {
      1 => StepLanguage(
          answers: answers,
          deviceLanguage: device.deviceLanguage,
          localeFromDevice: device.localeFromDevice,
          onChanged: changed,
        ),
      2 => StepOrigin(
          answers: answers,
          deviceCountry: device.deviceCountry,
          onChanged: changed,
        ),
      3 => StepAboutYou(answers: answers, onChanged: changed),
      4 => StepGoal(answers: answers, onChanged: changed),
      5 => StepCooking(answers: answers, onChanged: changed),
      _ => StepTarget(answers: answers, onChanged: changed),
    };
  }
}
