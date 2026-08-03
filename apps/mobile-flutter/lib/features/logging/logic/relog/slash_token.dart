/// `/` token parsing for the composer's relog picker.
///
/// Ported from the token section of `lib/logging/relog/relog.ts`. Pure: no
/// widgets, no controllers — just the arithmetic that decides whether the text
/// left of the caret is an open mention token.
library;

/// The character that opens a token, and that a committed pick KEEPS: a pick
/// reads as `/Phở bò`, the same shape that summoned it. Lives here rather than
/// in the composer because both the tokenizer and the card's label derivation
/// need to agree on it.
const String mentionPrefix = '/';

/// Vietnamese dish names contain spaces ("Cà phê sữa đá"), so the token cannot
/// stop at whitespace. Bound it instead, so a long sentence that happens to
/// start with `/` eventually closes the popup.
const int _maxTokenWords = 4;
const int _maxTokenLength = 40;

/// An active `/` token: where it starts, where the caret is, and what has been
/// typed after the slash.
class SlashToken {
  /// Index of the `/` in the full value.
  final int start;

  /// Caret position — the token's exclusive end.
  final int end;

  /// Text after the `/`, possibly empty.
  final String query;

  const SlashToken({
    required this.start,
    required this.end,
    required this.query,
  });

  @override
  bool operator ==(Object other) =>
      other is SlashToken &&
      other.start == start &&
      other.end == end &&
      other.query == query;

  @override
  int get hashCode => Object.hash(start, end, query);

  @override
  String toString() => 'SlashToken(start: $start, end: $end, query: "$query")';
}

final _whitespace = RegExp(r'\s');
final _leadingWhitespace = RegExp(r'^\s');
final _breaks = RegExp(r'[\n\r\t]');

/// Detect an active `/` token immediately left of [caret] in [value], or null
/// when no token is open.
///
/// The "`/` must start the text or follow whitespace" rule is what keeps
/// `1/2 quả`, `and/or` and `http://x` from ever opening the picker.
SlashToken? parseSlashToken(String value, int caret) {
  final end = caret.clamp(0, value.length);
  final left = value.substring(0, end);
  final start = left.lastIndexOf('/');
  if (start == -1) return null;

  // Must begin a word: start-of-text, or preceded by whitespace.
  if (start > 0 && !_whitespace.hasMatch(left[start - 1])) return null;

  final query = left.substring(start + 1);
  // `/ ` (slash then space) is prose, not a trigger.
  if (query.isNotEmpty && _leadingWhitespace.hasMatch(query)) return null;
  if (query.length > _maxTokenLength) return null;
  if (query.split(' ').length > _maxTokenWords) return null;
  // A newline always ends the token.
  if (_breaks.hasMatch(query)) return null;

  return SlashToken(start: start, end: end, query: query);
}

/// The composer value with an accepted token removed, plus where the caret
/// should land.
({String value, int caret}) stripSlashToken(String value, SlashToken token) => (
  value: value.substring(0, token.start) + value.substring(token.end),
  caret: token.start,
);
