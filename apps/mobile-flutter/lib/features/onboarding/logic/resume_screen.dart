/// Mapping between the SERVER's three onboarding steps and the wizard's six
/// screens: a profile that says "step 2" answered screens 1–2 and belongs on
/// screen 3. Signed out there is no server step — the draft counts screens.
library;

import '../data/constants.dart';

/// The first WIZARD screen of a server step: 1 → 1, 2 → 3, 3 → 5.
///
/// Deliberately the FIRST screen of the step rather than the last one answered:
/// a step is only partly captured by the time the server hears about it (screen
/// 4 posts step 2, and screen 6 posts it again), so dropping the user into the
/// middle of a step would skip questions the server never received.
int onboardingScreenForServerStep(int serverStep) => switch (serverStep) {
  <= 1 => 1,
  2 => 3,
  _ => 5,
};

/// The SERVER step a wizard screen completes on its way out, or `null` when it
/// completes none — screens 1 and 3 each collect half of one. The mapping the
/// wizard's `_payload` and [ServerOnboardingSink] agree on, so a skipped screen
/// still advances `onboardingStep` by the step it would have posted.
int? onboardingServerStepForScreen(int screen) => switch (screen) {
  2 => 1,
  4 || 6 => 2,
  5 => 3,
  _ => null,
};

/// The screen to resume a signed-OUT draft on: the one after the furthest
/// screen reached, clamped into the wizard.
int onboardingScreenForDraft(int screenReached) =>
    (screenReached + 1).clamp(1, kOnboardingScreenCount);
