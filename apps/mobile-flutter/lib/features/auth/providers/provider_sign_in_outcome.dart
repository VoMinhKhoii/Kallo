/// How a native provider sign-in flow ended, when it did not throw.
///
/// Shared by the Apple and Google flows so the controller maps both through
/// one state machine: [signedIn] clears the spinner (the router takes over),
/// [canceled] clears it silently, [missingToken] shows the provider's error.
enum ProviderSignInOutcome { signedIn, canceled, missingToken }
