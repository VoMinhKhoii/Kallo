/// Public surface for the onboarding feature.
///
/// The router imports `screens/onboarding_screen.dart` directly (the contract
/// class [OnboardingScreen]); this barrel re-exports the gate/completion
/// providers so other surfaces (and the router's `onboardingCompleteProvider`
/// seam) can read the real resume decision.
library;

export 'data/profile_row.dart';
export 'providers/onboarding_providers.dart'
    show
        OnboardingKeys,
        profileProvider,
        onboardingResumeProvider,
        onboardingResumeStepProvider,
        saveScreenControllerProvider,
        SaveScreenController;
export 'screens/onboarding_screen.dart' show OnboardingScreen;
