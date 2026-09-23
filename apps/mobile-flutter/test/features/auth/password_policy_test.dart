import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/logic/password_policy.dart';

/// Mirrors the web's `lib/core/validation/__tests__/password.test.ts`: the
/// production Supabase policy is 8+ characters with a letter and a digit, and
/// bcrypt caps the input at 72 bytes.
void main() {
  group('newPasswordIssue (sign-up)', () {
    test('rejects 7 characters even with a letter and a digit', () {
      expect(newPasswordIssue('abcdef1'), PasswordIssue.tooShort);
    });

    test('rejects letters only and digits only', () {
      expect(newPasswordIssue('abcdefgh'), PasswordIssue.needsDigit);
      expect(newPasswordIssue('12345678'), PasswordIssue.needsLetter);
    });

    test('accepts the shortest valid password and a long passphrase', () {
      expect(newPasswordIssue('abcdefg1'), isNull);
      expect(newPasswordIssue('correct horse battery staple 42'), isNull);
    });

    test('caps at 72 UTF-8 bytes, not characters', () {
      final at = '${'a' * 71}1';
      expect(newPasswordIssue(at), isNull);
      expect(newPasswordIssue('${at}b'), PasswordIssue.tooLong);
      // 37 characters, 73 bytes.
      expect(newPasswordIssue('${'ă' * 36}1'), PasswordIssue.tooLong);
    });
  });

  group('existingPasswordIssue (sign-in)', () {
    test('accepts an old 6-character, letters-only password', () {
      expect(existingPasswordIssue('hunter'), isNull);
    });

    test('only refuses an empty or over-long value', () {
      expect(existingPasswordIssue(''), PasswordIssue.required);
      expect(existingPasswordIssue('a' * 73), PasswordIssue.tooLong);
      expect(existingPasswordIssue('1'), isNull);
    });
  });
}
