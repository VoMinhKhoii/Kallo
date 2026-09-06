import 'dart:math' as math;

import 'mascot_timing.dart';

/// Every vowel the app can type, precomposed. Decomposed input is handled by
/// skipping combining marks in [BunFace.isVowel] — the "diacritics stripped"
/// rule from the motion study.
const String _kVowels =
    'aeiouy'
    'àáâãăạảấầẩẫậắằẳẵặ'
    'èéêẹẻẽếềểễệ'
    'ìíỉĩị'
    'òóôõơọỏốồổỗộớờởỡợ'
    'ùúũưụủứừửữự'
    'ỳýỷỹỵ';

/// The bun's face as a plain state machine: when the eyes blink and how open
/// the mouth is. No widgets, no ticker — the widget owns the clock and hands it
/// a [tick]; the bubble hands it one grapheme at a time through [speak].
///
/// The two are coupled on purpose: a pending or running blink swallows the
/// viseme and closes the mouth, keeping the [kBunGuard] window clear. An eyelid
/// landing on the same frame as a mouth swap reads as a glitch.
class BunFace {
  BunFace({math.Random? random}) : _random = random ?? math.Random();

  static const Duration _never = Duration(days: -1);

  final math.Random _random;

  Duration _now = Duration.zero;
  Duration _nextBlink = kBunMountBlink;
  Duration _mouthAt = _never;
  Duration? _blinkAt;
  Duration? _doubleAt;
  Duration _lidHold = kBunLidHoldMin;
  bool _blinkDouble = false;
  bool _pending = false;

  /// Mouth open on an "ah" — the `wide` frame.
  bool wide = false;

  /// How far the eyelids are down, 0 (open) to 1 (shut) — the `blink` frame's
  /// opacity over an always-opaque base.
  double lid = 0;

  bool get _blinking => _pending || _blinkAt != null || _doubleAt != null;

  /// Advances the face to [now]. Returns true when something visible changed.
  bool tick(Duration now) {
    _now = now;
    var changed = false;
    if (now >= _nextBlink && !_blinking) _pending = true;

    final doubleAt = _doubleAt;
    if (doubleAt != null && now >= doubleAt) {
      _doubleAt = null;
      _start(now, second: true);
    }
    if (_pending && _blinkAt == null && _doubleAt == null) {
      if (wide) {
        changed = _setMouth(wide: false);
      } else if (now - _mouthAt >= kBunGuard) {
        _start(now);
      }
    }

    var next = 0.0;
    final blinkAt = _blinkAt;
    if (blinkAt != null) {
      final age = now - blinkAt;
      next = _lidAmount(age);
      if (age >= kBunLidClose + _lidHold + kBunLidOpen) {
        if (_blinkDouble) _doubleAt = now + kBunDoubleGap;
        _blinkAt = null;
        _nextBlink = now + _between(kBunBlinkMin, kBunBlinkMax);
      }
    }
    if (next != lid) {
      lid = next;
      changed = true;
    }
    return changed;
  }

  /// One grapheme from the bubble's typewriter. Returns true when the mouth
  /// changed shape.
  bool speak(String cluster) {
    if (_blinking) return _setMouth(wide: false);
    if (_now - _mouthAt < kBunViseme) return false;
    return _setMouth(wide: isVowel(cluster));
  }

  static bool isVowel(String cluster) {
    for (final rune in cluster.toLowerCase().runes) {
      if (rune >= 0x0300 && rune <= 0x036F) continue; // combining mark
      return _kVowels.contains(String.fromCharCode(rune));
    }
    return false;
  }

  bool _setMouth({required bool wide}) {
    if (wide == this.wide) return false;
    this.wide = wide;
    _mouthAt = _now;
    return true;
  }

  void _start(Duration now, {bool second = false}) {
    _blinkAt = now;
    _lidHold = _between(kBunLidHoldMin, kBunLidHoldMax);
    _blinkDouble = !second && _random.nextDouble() < kBunDoubleChance;
    _pending = false;
  }

  /// Asymmetric eyelid: a fast drop, a flat hold, a slower lift.
  double _lidAmount(Duration age) {
    if (age < kBunLidClose) {
      return age.inMicroseconds / kBunLidClose.inMicroseconds;
    }
    if (age < kBunLidClose + _lidHold) return 1;
    final open = age - kBunLidClose - _lidHold;
    return math.max(0, 1 - open.inMicroseconds / kBunLidOpen.inMicroseconds);
  }

  Duration _between(Duration a, Duration b) => Duration(
    milliseconds:
        a.inMilliseconds +
        _random.nextInt(b.inMilliseconds - a.inMilliseconds + 1),
  );
}
