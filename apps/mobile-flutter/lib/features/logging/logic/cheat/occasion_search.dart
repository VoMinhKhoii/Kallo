import '../../../../models/logging/cheat.dart';

/// Filters past cheat occasions against what is typed in the composer.
///
/// The `/` picker searches a token the user opened on purpose and sends every
/// query to the server. Cheat mode has no token: the query IS the field, and
/// most of what gets typed there is a new meal, not a search. So this runs on
/// the device, over the short list already fetched, on every keystroke — and
/// an empty result is the normal case that hides the picker, not a "no
/// results" state.
///
/// Matching, per query word (every word must match, in any order, so
/// "gà cơm" finds "30 gr cơm + 2 miếng gà rán"):
/// - case-insensitive substring of the occasion text;
/// - a word typed WITH diacritics compares against the text as written — they
///   are load-bearing in Vietnamese (bò is beef, bơ is butter);
/// - a word typed WITHOUT them compares against the text with its diacritics
///   folded, so "do thai" still finds "đồ thái". The same split the server's
///   ingredient search makes (`search_text` vs `search_text_ascii`).
///
/// Order is kept: the server returns newest first, and the newest match is the
/// likeliest repeat.
List<RecentCheatOccasion> filterCheatOccasions(
  List<RecentCheatOccasion> occasions,
  String query,
) {
  final words = _words(query);
  if (words.isEmpty) return occasions;
  return [
    for (final occasion in occasions)
      if (_matches(occasion.rawInput, words)) occasion,
  ];
}

bool _matches(String text, List<String> words) {
  final lower = text.toLowerCase();
  final folded = foldVietnamese(lower);
  for (final word in words) {
    final haystack = _isAscii(word) ? folded : lower;
    if (!haystack.contains(word)) return false;
  }
  return true;
}

List<String> _words(String query) =>
    query.toLowerCase().split(_separator).where((w) => w.isNotEmpty).toList();

final _separator = RegExp(r'[^\p{L}\p{M}\p{N}]+', unicode: true);

bool _isAscii(String s) => s.codeUnits.every((c) => c < 0x80);

/// Lowercase Vietnamese text with its tone and vowel marks removed:
/// "đồ thái" → "do thai". Expects lowercase input. Also drops any stray
/// combining mark, so decomposed (NFD) text folds the same as composed.
String foldVietnamese(String lower) {
  final out = StringBuffer();
  for (final rune in lower.runes) {
    if (_isCombiningMark(rune)) continue;
    final char = String.fromCharCode(rune);
    out.write(_fold[char] ?? char);
  }
  return out.toString();
}

bool _isCombiningMark(int rune) => rune >= 0x0300 && rune <= 0x036F;

final Map<String, String> _fold = {
  for (final entry
      in const {
        'a': 'àáạảãâầấậẩẫăằắặẳẵ',
        'e': 'èéẹẻẽêềếệểễ',
        'i': 'ìíịỉĩ',
        'o': 'òóọỏõôồốộổỗơờớợởỡ',
        'u': 'ùúụủũưừứựửữ',
        'y': 'ỳýỵỷỹ',
        'd': 'đ',
      }.entries)
    for (final accented in entry.value.split('')) accented: entry.key,
};
