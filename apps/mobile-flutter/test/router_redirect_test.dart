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

/// The returning user who walks the wizard and THEN signs in with Apple or
/// Google — an existing account, so `firstSession` is false throughout.
///
/// On device this sequence ends "account activated, then the paywall, then
/// sometimes a blank screen". These pin every redirect decision along it, so
/// the rule is ruled in or out of that: at no point may it park the user on
/// the splash or bounce them off the screen they were sent to.
void _returningUserSignsInAfterOnboarding() {
  group('a returning user who signs in AFTER the wizard', () {
    // The wizard ran signed out, so the answers are still on disk and the
    // profile is mid-invalidate for most of this — every step save drops it.
    test('lands on /welcome to flush, not back into the wizard', () {
      expect(
        _at(
          '/save-plan',
          signedIn: true,
          draft: _finishedDraft,
          profileLoading: true,
        ),
        '/welcome',
      );
    });

    test('/welcome is never redirected off mid-flush', () {
      // Draft still on disk, profile loading, dismissed not yet set: the state
      // the interstitial actually sits in while its three saves are in flight.
      expect(
        _at(
          '/welcome',
          signedIn: true,
          draft: _finishedDraft,
          profileLoading: true,
        ),
        isNull,
      );
      // And again once the flush has cleared the draft but the reads have not
      // returned, which is where `finish()` spends most of its time.
      expect(_at('/welcome', signedIn: true, profileLoading: true), isNull);
    });

    test('the paywall it hands off to is left alone, not parked on /', () {
      // What `finish()` leaves behind: draft flushed, dismissal set.
      expect(
        _at('/paywall', signedIn: true, dismissed: true, profileLoading: true),
        isNull,
      );
      // And without the dismissal, which is the window before `finish()`
      // reaches its last line: still fine, because this user is not a
      // first-session account and the force rules never apply to them.
      expect(_at('/paywall', signedIn: true, profileLoading: true), isNull);
    });

    test('both paywall exits reach the app', () {
      expect(_at('/dashboard', signedIn: true, dismissed: true), isNull);
      expect(_at('/logging', signedIn: true, dismissed: true), isNull);
    });

    // The one state that CAN strand this user on the splash, and the reason
    // the sequence above is worth pinning: a session that goes back to
    // loading with nothing cached takes every route to `/` and holds it
    // there. Nothing in the flush path should do that — if a device ever
    // shows the splash here, this is the input to look for.
    test('only an unsettled session parks them on the splash', () {
      expect(_at('/paywall', signedIn: true, sessionLoading: true), '/');
      expect(_at('/', signedIn: true, sessionLoading: true), isNull);
    });
  });
}

void main() {
  _returningUserSignsInAfterOnboarding();

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
        // The email path is a route of its own now, pushed off each of the two
        // surfaces that offer it — and a signed-out user is exactly who stands
        // on it, so it must be allowed as explicitly as its parent.
        '/sign-in/email',
        '/sign-up',
        '/start',
        '/onboarding',
        '/save-plan',
        '/save-plan/email',
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
