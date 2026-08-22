/// The invite sheet's client-side identity rules: what a handle draft has to
/// look like, when to complain about it, and how a display-name draft is sent.
///
/// A light mirror of web `lib/domain/social/identity/handles.ts` — enough to
/// flag obviously-bad input before the round-trip. The server still owns the
/// reserved-word and uniqueness checks, so a draft passing these is not yet
/// guaranteed to save.
library;

/// Web `HANDLE_MIN_LENGTH`.
const int kHandleMinLength = 3;

/// Web `HANDLE_MAX_LENGTH`.
const int kHandleMaxLength = 20;

/// Web `DISPLAY_NAME_MAX` — the server schema caps at 50 too.
const int kDisplayNameMax = 50;

/// Web `HANDLE_PATTERN`.
final RegExp _handleShape = RegExp(
  '^[a-z0-9_]{$kHandleMinLength,$kHandleMaxLength}\$',
);

final RegExp _leadingAt = RegExp(r'^@+');

/// A handle draft as the server would see it: trimmed, lowercased, leading @s
/// stripped (people paste "@handle" from social bios).
String normalizeHandle(String raw) =>
    raw.trim().toLowerCase().replaceAll(_leadingAt, '');

/// Whether an already-[normalizeHandle]d draft matches the shape the server
/// enforces.
bool isValidHandleShape(String normalized) => _handleShape.hasMatch(normalized);

/// Whether to show the inline "that won't work" line. Only surface the issue
/// once they've typed a plausible length — the web waits for
/// [kHandleMinLength] before flagging.
bool showsHandleIssue(String normalized) =>
    !isValidHandleShape(normalized) && normalized.length >= kHandleMinLength;

/// A display-name draft as it should be sent: trimmed, and null when empty —
/// an explicit null clears the saved name, whereas omitting the field keeps it.
String? normalizeDisplayName(String raw) {
  final trimmed = raw.trim();
  return trimmed.isEmpty ? null : trimmed;
}
