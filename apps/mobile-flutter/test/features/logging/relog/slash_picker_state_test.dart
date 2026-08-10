import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/logic/relog/slash_picker_state.dart';
import 'package:nham_mobile/features/logging/logic/relog/slash_token.dart';

/// Sync the picker against the token that `value` would produce with the caret
/// at its end — how the composer drives it.
SlashPickerState _type(SlashPickerState state, String value) =>
    state.sync(parseSlashToken(value, value.length));

void main() {
  const closed = SlashPickerState();

  test('stays closed until a slash token appears', () {
    expect(_type(closed, 'phở bò').isOpen, isFalse);
  });

  test('opens on a slash and carries its query', () {
    final state = _type(closed, '/pho');
    expect(state.isOpen, isTrue);
    expect(state.query, 'pho');
  });

  test(
    'an empty query is open, not closed — those are staples, not nothing',
    () {
      final state = _type(closed, '/');
      expect(state.isOpen, isTrue);
      expect(state.query, '');
    },
  );

  test('closes when the token stops parsing', () {
    var state = _type(closed, '/pho');
    state = _type(state, '/pho bo cha ca la vong nhieu chu qua');
    expect(state.isOpen, isFalse);
  });

  group('query debounce', () {
    test('opening the picker resolves immediately', () {
      // `/` with nothing after it asks for the staples — a cached list, and the
      // moment the popup appears. Debouncing it would show an empty box first.
      expect(SlashPickerState.resolvesImmediately(null, ''), isTrue);
      expect(SlashPickerState.resolvesImmediately(null, 'pho'), isTrue);
    });

    test('backspacing to an empty query resolves immediately', () {
      expect(SlashPickerState.resolvesImmediately('pho', ''), isTrue);
      expect(SlashPickerState.resolvesImmediately('pho', '   '), isTrue);
    });

    test('typing on into an open picker is debounced', () {
      // Every keystroke here is otherwise a pair of unindexed scans.
      expect(SlashPickerState.resolvesImmediately('', 'p'), isFalse);
      expect(SlashPickerState.resolvesImmediately('ph', 'pho'), isFalse);
    });
  });

  group('dismissal', () {
    test('dismiss closes without touching the text', () {
      final open = _type(closed, '/pho');
      final state = open.dismiss();
      expect(state.isOpen, isFalse);
      expect(state.dismissedAt, open.token!.start);
    });

    test('does not re-open while typing into the dismissed token', () {
      var state = _type(closed, '/pho').dismiss();
      state = _type(state, '/phob');
      expect(state.isOpen, isFalse, reason: 'same slash, still dismissed');
      state = _type(state, '/phobo');
      expect(state.isOpen, isFalse);
    });

    test('re-opens for a NEW slash after a dismissal', () {
      var state = _type(closed, '/pho').dismiss();
      state = _type(state, '/pho /bun');
      expect(state.isOpen, isTrue);
      expect(state.query, 'bun');
    });

    test('a dismissal is forgotten once its token is gone', () {
      var state = _type(closed, '/pho').dismiss();
      // The user deletes the whole token…
      state = _type(state, '');
      expect(state.dismissedAt, isNull);
      // …so the very next slash, at the same offset, opens again.
      state = _type(state, '/pho');
      expect(state.isOpen, isTrue);
    });

    test('close() is not a dismissal — the same offset re-opens', () {
      // A committed pick closes the picker. Treating that as a dismissal would
      // stop the next `/` typed at the same spot from ever opening.
      var state = _type(closed, '/pho').close();
      expect(state.dismissedAt, isNull);
      state = _type(state, '/bun');
      expect(state.isOpen, isTrue);
    });
  });
}
