import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/router_redirect.dart';

/// Onboarding runs BEFORE sign-in (Phase C2), so "signed out" has no single
/// answer — the local draft decides between `/start`, `/onboarding` and
/// `/save-plan`. These are the rules quoted on [resolveRedirect], read back
/// without a Supabase client or a single pumped screen.

/// The signed-out defaults: no session, no draft, nothing pending.
String? _at(
  String location, {
  bool sessionLoading = false,
  bool signedIn = false,
  bool draftLoading = false,
  OnboardingDraft? draft,
  bool firstSession = false,
  bool dismissed = false,
  bool profileLoading = false,
  bool resumeOnboarding = false,
  String? pendingInvite,
}) =>
    resolveRedirect(
      location: location,
      sessionLoading: sessionLoading,
      signedIn: signedIn,
      draft: (loading: draftLoading, value: draft),
      firstSession: firstSession,
      dismissed: dismissed,
      onboarding: (force: resumeOnboarding, loading: profileLoading),
      pendingInvite: pendingInvite,
    );

/// Got as far as screen 2 — answers on disk, wizard unfinished.
const _partialDraft = OnboardingDraft(
  step1: {'countryOfOrigin': 'Vietnam'},
  screenReached: 2,
);

/// Every screen answered, every server step written.
const _finishedDraft = OnboardingDraft(
  step1: {'countryOfOrigin': 'Vietnam'},
  step2: {'weightKg': 70},
  step3: {'oil': 'normal'},
  screenReached: 6,
);

/// The same, from a user who left the OPTIONAL body metrics blank: `step2` is
/// absent and `isComplete` false, but every screen was answered.
const _blankMetricsDraft = OnboardingDraft(
  step1: {'countryOfOrigin': 'Vietnam'},
  step3: {'oil': 'normal'},
  screenReached: 6,
);

void main() {
  test('the splash holds while the session is restoring', () {
    expect(_at('/', sessionLoading: true), isNull);
    expect(_at('/dashboard', sessionLoading: true), '/');
  });

  group('signed out', () {
    test('with no draft, every other route lands on /start', () {
      expect(_at('/'), '/start');
      expect(_at('/dashboard'), '/start');
      expect(_at('/logging'), '/start');
    });

    test('with a partial draft, back into the wizard', () {
      expect(_at('/', draft: _partialDraft), '/onboarding');
      expect(_at('/dashboard', draft: _partialDraft), '/onboarding');
    });

    test('having finished the wizard, on to /save-plan', () {
      expect(_at('/', draft: _finishedDraft), '/save-plan');
    });

    test('blank body metrics still count as finished', () {
      // Gating on `isComplete` would bounce this user back into a wizard they
      // have no answers left to give.
      expect(_blankMetricsDraft.isComplete, isFalse);
      expect(_at('/', draft: _blankMetricsDraft), '/save-plan');
    });

    test('the pre-auth routes are all reachable', () {
      for (final loc in const [
        '/sign-in',
        '/sign-up',
        '/start',
        '/onboarding',
        '/save-plan',
        '/circle/invite/abc',
      ]) {
        expect(_at(loc, draft: _finishedDraft), isNull, reason: loc);
      }
    });

    test('holds the splash while the draft is still off disk', () {
      // Not `/start`: a user three screens in must not flash the entry screen
      // on every cold start.
      expect(_at('/', draftLoading: true), isNull);
      expect(_at('/dashboard', draftLoading: true), '/');
    });
  });

  group('signed in', () {
    test('with a draft still on disk, /welcome flushes it', () {
      expect(_at('/', signedIn: true, draft: _finishedDraft), '/welcome');
      expect(
        _at('/dashboard', signedIn: true, draft: _partialDraft),
        '/welcome',
      );
      // …and /welcome itself is never bounced.
      expect(_at('/welcome', signedIn: true, draft: _finishedDraft), isNull);
    });

    test('with no draft and not a first session, straight to the app', () {
      expect(_at('/', signedIn: true), '/dashboard');
      expect(_at('/sign-in', signedIn: true), '/dashboard');
      // The pre-auth flow is not a place a signed-in user can sit.
      expect(_at('/start', signedIn: true), '/dashboard');
      expect(_at('/save-plan', signedIn: true), '/dashboard');
      // In-app routes are left alone.
      expect(_at('/dashboard', signedIn: true), isNull);
      expect(_at('/paywall', signedIn: true), isNull);
    });

    test('a brand-new account is still forced through the wizard', () {
      expect(
        _at('/', signedIn: true, firstSession: true, profileLoading: true),
        isNull,
      );
      expect(
        _at('/', signedIn: true, firstSession: true, resumeOnboarding: true),
        '/onboarding',
      );
      // Skipping out of it stops the forcing for the session.
      expect(
        _at(
          '/',
          signedIn: true,
          firstSession: true,
          resumeOnboarding: true,
          dismissed: true,
        ),
        '/dashboard',
      );
    });

    test('a pending invite outranks the dashboard', () {
      expect(_at('/', signedIn: true, pendingInvite: 'abc'),
          '/circle/invite/abc');
    });
  });
}
