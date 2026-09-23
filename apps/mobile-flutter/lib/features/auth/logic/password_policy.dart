import 'dart:convert';

/// The password policy, mirrored from Supabase Auth (GoTrue) — the same rules
/// as the web's `lib/core/validation/password.ts`. The server is the authority
/// (production: the Supabase dashboard; local: `supabase/config.toml`); these
/// checks only let the form say what the server would say, before the round
/// trip. Change one side, change all three.
///
/// Length is measured as GoTrue measures it, in UTF-8 bytes, and the
/// composition rule is GoTrue's `letters_digits`: at least one ASCII letter and
/// one ASCII digit.
const int kPasswordMinLength = 8;

/// bcrypt, which Supabase hashes passwords with, only reads the first 72 bytes
/// and silently ignores the rest, so GoTrue refuses anything longer outright.
const int kPasswordMaxBytes = 72;

/// Why a password failed the form's check.
enum PasswordIssue { required, tooShort, tooLong, needsLetter, needsDigit }

final _hasLetter = RegExp('[A-Za-z]');
final _hasDigit = RegExp(r'\d');

bool _fitsBcrypt(String value) =>
    utf8.encode(value).length <= kPasswordMaxBytes;

/// A password being CREATED (sign-up). `null` when it meets the policy.
PasswordIssue? newPasswordIssue(String value) {
  if (value.length < kPasswordMinLength) return PasswordIssue.tooShort;
  if (!_fitsBcrypt(value)) return PasswordIssue.tooLong;
  if (!_hasLetter.hasMatch(value)) return PasswordIssue.needsLetter;
  if (!_hasDigit.hasMatch(value)) return PasswordIssue.needsDigit;
  return null;
}

/// A password being USED (sign-in). Deliberately none of the length or
/// composition rules: accounts created under the older 6-character policy
/// still hold those passwords, and whether a credential is right is the
/// server's call. Judging them here would lock their owners out of the very
/// account they need to reach to pick a stronger one.
PasswordIssue? existingPasswordIssue(String value) {
  if (value.isEmpty) return PasswordIssue.required;
  if (!_fitsBcrypt(value)) return PasswordIssue.tooLong;
  return null;
}
