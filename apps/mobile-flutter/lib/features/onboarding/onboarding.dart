/// Public surface for the onboarding feature.
///
/// The router imports `screens/onboarding_screen.dart` directly (the contract
/// class [OnboardingScreen]); this barrel re-exports the gate/completion
/// providers so other surfaces (and the router's onboarding redirect gate) can
/// read the real resume decision and the session-scoped dismissed flag.
library;

export 'data/profile_row.dart';
export 'providers/onboarding_providers.dart'
    show
        OnboardingKeys,
        profileProvider,
        onboardingResumeProvider,
        onboardingResumeStepProvider,
        onboardingForceDismissedProvider,
        saveScreenControllerProvider,
        SaveScreenController;
export 'screens/onboarding_screen.dart' show OnboardingScreen;
