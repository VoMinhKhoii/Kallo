/// The composer's `/` relog picker, driven.
///
/// [SlashPickerState] is the pure open/closed rule; this is everything around
/// it that has to live somewhere stateful — the debounce in front of the
/// search, and committing a pick into the composer's text.
library;

import 'dart:async' show Timer;

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../../../../models/logging/relog.dart';
import '../../widgets/relog/mention_text_controller.dart';
import 'slash_picker_state.dart';

const _uuid = Uuid();

class RelogPickerController {
  RelogPickerController({required this.composer, required this.onChanged});

  /// The composer's text AND the relog picks living inside it as tinted runs.
  /// The picker reads the token at the caret from it and writes picks back
  /// into it.
  final MentionTextEditingController composer;

  /// Something the feed renders changed — rebuild.
  final VoidCallback onChanged;

  SlashPickerState _state = const SlashPickerState();

  /// The DEBOUNCED query behind [_state] — what the search actually asks for.
  /// Null whenever the picker is closed.
  String? _query;
  Timer? _debounce;

  String? get query => _query;

  /// One handler for every "the value or the caret may have moved" signal.
  ///
  /// The mentions have already been re-located by the controller; this decides
  /// whether a `/` token is open at the caret and, if so, what to search for.
  ///
  /// [enabled] is relog's normal-mode gate: manual and cheat own the composer's
  /// slots themselves, and the server rejects a cheat submission carrying picks.
  void sync({required bool enabled}) {
    final next = _state.sync(enabled ? composer.activeToken : null);
    if (next == _state) return;
    final queryChanged = next.query != _state.query;
    _state = next;
    onChanged();
    if (queryChanged) _scheduleQuery(next.query);
  }

  /// Commit a pick: its label is written into the composer as a tinted run and
  /// its reference is staged. Returns false when the staged cap was already
  /// reached, so the caller can say so rather than silently dropping the tap.
  bool select(RelogCandidate candidate) {
    final token = _state.token;
    if (token == null) return true;
    final added = composer.addMention(candidate, token, _uuid.v4());
    // close(), not dismiss(): a pick is not a refusal, so the next `/` — even
    // one landing at the same offset — must open normally.
    _close(_state.close());
    return added;
  }

  /// The user closed the picker explicitly (the popup's close control).
  void dismiss() => _close(_state.dismiss());

  void dispose() => _debounce?.cancel();

  /// Debounce the search so typing a dish name is one request, not eight.
  /// Opening the picker (`/` with nothing after it) resolves immediately —
  /// that list is the user's staples and is almost always already cached.
  void _scheduleQuery(String? query) {
    _debounce?.cancel();
    if (query == null) {
      if (_query != null) {
        _query = null;
        onChanged();
      }
      return;
    }
    final trimmed = query.trim();
    if (SlashPickerState.resolvesImmediately(_query, trimmed)) {
      _query = trimmed;
      onChanged();
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _query = trimmed;
      onChanged();
    });
  }

  void _close(SlashPickerState next) {
    _debounce?.cancel();
    _state = next;
    _query = null;
    onChanged();
  }
}
