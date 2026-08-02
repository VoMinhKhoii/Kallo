/// The `/` picker's open/closed state machine.
///
/// Ported from the state half of the web's `use-slash-picker.ts`. Pure and
/// immutable so the one rule that is easy to get wrong — "Escape must not
/// re-open on the next keystroke, but a NEW slash must" — can be tested without
/// pumping a composer.
library;

import 'slash_token.dart';

class SlashPickerState {
  /// The token the picker is currently open on, or null when closed.
  final SlashToken? token;

  /// Where a DISMISSED token began. Remembering the offset (rather than
  /// suppressing the picker with a bare flag) is what lets typing on into the
  /// dismissed token stay closed while a fresh `/` re-opens.
  final int? dismissedAt;

  const SlashPickerState({this.token, this.dismissedAt});

  bool get isOpen => token != null;

  /// The text after the `/`, or null when closed. Null and empty mean
  /// different things: empty is "show my staples", a real result set.
  String? get query => token?.query;

  /// Fold in the token now at the caret ([next] is null when there is none).
  SlashPickerState sync(SlashToken? next) {
    // Still inside the token the user dismissed — stay closed, and keep
    // remembering it.
    if (next != null && next.start == dismissedAt) {
      return SlashPickerState(dismissedAt: dismissedAt);
    }
    // Anything else means the dismissal no longer applies: either the token is
    // gone, or this is a different `/`.
    return SlashPickerState(token: next);
  }

  /// The user closed the picker explicitly. A phone keyboard has no Escape, so
  /// this comes from the popup's close control.
  SlashPickerState dismiss() => SlashPickerState(dismissedAt: token?.start);

  /// Close after a pick was committed — NOT a dismissal, so the next `/`
  /// (including one at the same offset) opens normally.
  SlashPickerState close() => const SlashPickerState();

  @override
  bool operator ==(Object other) =>
      other is SlashPickerState &&
      other.token == token &&
      other.dismissedAt == dismissedAt;

  @override
  int get hashCode => Object.hash(token, dismissedAt);
}
