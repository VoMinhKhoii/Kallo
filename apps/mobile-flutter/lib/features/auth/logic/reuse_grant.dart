/// Reusing a sign-in grant the user has already given, before asking for a
/// new one.
library;

/// Returns the account a previous grant still covers, falling back to the full
/// interactive flow only when there is none.
///
/// [lightweight] is the provider's silent/minimal-UI attempt. Note the DOUBLE
/// optionality, which is the whole reason this is a named helper rather than
/// two inline lines: `google_sign_in` v7's
/// `attemptLightweightAuthentication()` returns `Future<Account?>?` — the
/// FUTURE itself is nullable. A platform that cannot answer synchronously-ish
/// (FedCM on the web is the documented example) hands back `null` instead of a
/// future, and only a stream event will ever say whether a sign-in happened.
/// Both nulls mean the same thing to us — no grant on hand — and both must
/// fall through to [authenticate] rather than being awaited into a crash.
///
/// Generic over the account type because the provider's account class has a
/// private constructor: a test cannot build one, so the seam is typed by its
/// caller and exercised with a stand-in.
Future<T> reuseGrantOrAuthenticate<T extends Object>({
  required Future<T?>? Function() lightweight,
  required Future<T> Function() authenticate,
}) async {
  final attempt = lightweight();
  if (attempt != null) {
    final existing = await attempt;
    if (existing != null) return existing;
  }
  return authenticate();
}
