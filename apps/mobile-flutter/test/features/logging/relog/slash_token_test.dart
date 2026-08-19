import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/relog/slash_token.dart';

/// Parse with the caret at the end of the text, which is where it sits while
/// the user is typing a token.
SlashToken? _atEnd(String value) => parseSlashToken(value, value.length);

void main() {
  group('parseSlashToken', () {
    test('stays closed until a slash token appears', () {
      expect(_atEnd('phở bò'), isNull);
    });

    test('opens on a slash starting the text', () {
      expect(_atEnd('/'), const SlashToken(start: 0, end: 1, query: ''));
      expect(_atEnd('/pho'), const SlashToken(start: 0, end: 4, query: 'pho'));
    });

    test('opens on a slash after whitespace', () {
      expect(
        _atEnd('sáng nay /pho'),
        const SlashToken(start: 9, end: 13, query: 'pho'),
      );
    });

    test('does not open on a mid-word slash', () {
      expect(_atEnd('and/or'), isNull);
    });

    test('does not open inside a fraction', () {
      expect(_atEnd('1/2'), isNull);
    });

    test('does not open inside a URL', () {
      expect(_atEnd('http://x'), isNull);
    });

    test('does not treat slash-space as a trigger', () {
      expect(_atEnd('/ pho'), isNull);
    });

    test('closes when the caret moves left of the slash', () {
      // "sáng /pho" with the caret at index 4 — before the slash entirely.
      expect(parseSlashToken('sáng /pho', 4), isNull);
    });

    test('keeps multi-word queries: Vietnamese dish names contain spaces', () {
      expect(
        _atEnd('/ca phe sua'),
        const SlashToken(start: 0, end: 11, query: 'ca phe sua'),
      );
    });

    test('closes past four words', () {
      expect(_atEnd('/a b c d'), isNotNull);
      expect(_atEnd('/a b c d e'), isNull);
    });

    test('closes past forty characters', () {
      expect(_atEnd('/${'a' * 40}'), isNotNull);
      expect(_atEnd('/${'a' * 41}'), isNull);
    });

    test('a newline always ends the token', () {
      expect(_atEnd('/pho\nbò'), isNull);
    });

    test('claims the slash nearest the caret', () {
      expect(
        _atEnd('/pho /bun'),
        const SlashToken(start: 5, end: 9, query: 'bun'),
      );
    });

    test('clamps a caret past the end of the value', () {
      expect(
        parseSlashToken('/pho', 99),
        const SlashToken(start: 0, end: 4, query: 'pho'),
      );
    });
  });

  group('stripSlashToken', () {
    test('removes the token and parks the caret where it began', () {
      const value = 'sáng /pho nay';
      final token = parseSlashToken(value, 9)!;
      expect(token.query, 'pho');

      final result = stripSlashToken(value, token);
      expect(result.value, 'sáng  nay');
      expect(result.caret, token.start);
    });
  });
}
