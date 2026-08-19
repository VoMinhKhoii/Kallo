import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/logic/handle_validation.dart';

void main() {
  group('normalizeHandle', () {
    test('trims surrounding whitespace', () {
      expect(normalizeHandle('  khoi  '), 'khoi');
    });

    test('lowercases, so the shape check is case-insensitive', () {
      expect(normalizeHandle('KhoiVo'), 'khoivo');
    });

    test('strips leading @ — people paste "@handle" from social bios', () {
      expect(normalizeHandle('@khoi'), 'khoi');
      expect(normalizeHandle('@@@khoi'), 'khoi');
    });

    test('strips the @ after trimming, not before', () {
      expect(normalizeHandle('  @Khoi '), 'khoi');
    });

    test(
      'leaves an interior @ alone — only the prefix is a paste artefact',
      () {
        expect(normalizeHandle('kh@i'), 'kh@i');
      },
    );

    test('an empty draft normalizes to empty, not null', () {
      expect(normalizeHandle('   '), '');
    });
  });

  group('isValidHandleShape', () {
    test('accepts lowercase letters, digits and underscore', () {
      expect(isValidHandleShape('khoi_vo9'), isTrue);
    });

    test('accepts the boundary lengths', () {
      expect(isValidHandleShape('abc'), isTrue);
      expect(isValidHandleShape('a' * 20), isTrue);
    });

    test('rejects shorter than the minimum', () {
      expect(isValidHandleShape('ab'), isFalse);
    });

    test('rejects longer than the maximum', () {
      expect(isValidHandleShape('a' * 21), isFalse);
    });

    test('rejects uppercase — the caller normalizes first', () {
      expect(isValidHandleShape('Khoi'), isFalse);
    });

    test('rejects punctuation, spaces and non-ASCII', () {
      expect(isValidHandleShape('khoi-vo'), isFalse);
      expect(isValidHandleShape('khoi vo'), isFalse);
      expect(isValidHandleShape('khôi'), isFalse);
    });

    test('rejects empty', () {
      expect(isValidHandleShape(''), isFalse);
    });

    test('is anchored — a valid run inside junk does not pass', () {
      expect(isValidHandleShape('!!khoi!!'), isFalse);
      expect(isValidHandleShape('khoi\nvo'), isFalse);
    });
  });

  group('showsHandleIssue', () {
    test('stays quiet while the draft is still too short to judge', () {
      expect(showsHandleIssue(''), isFalse);
      expect(showsHandleIssue('ab'), isFalse);
    });

    test('flags an invalid draft once it reaches the minimum length', () {
      expect(showsHandleIssue('a-b'), isTrue);
    });

    test('stays quiet for a valid draft', () {
      expect(showsHandleIssue('khoi'), isFalse);
    });
  });

  group('normalizeDisplayName', () {
    test('trims', () {
      expect(normalizeDisplayName('  Khoi  '), 'Khoi');
    });

    test('an empty draft is null — that clears the saved name', () {
      expect(normalizeDisplayName(''), isNull);
      expect(normalizeDisplayName('   '), isNull);
    });

    test('keeps case and interior spacing', () {
      expect(normalizeDisplayName('Võ Minh Khôi'), 'Võ Minh Khôi');
    });
  });

  group('limits mirror the server schema', () {
    test('handle length bounds match the shape regex', () {
      expect(kHandleMinLength, 3);
      expect(kHandleMaxLength, 20);
    });

    test('display name cap matches the web DISPLAY_NAME_MAX', () {
      expect(kDisplayNameMax, 50);
    });
  });
}
