import 'dart:developer' as developer;
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../theme/kallo_theme.dart';
import 'bun_face.dart';
import 'guide_bubble.dart';
import 'mascot_timing.dart';

/// The guide band: the animated bun beside its [GuideBubble].
///
/// ONE [Ticker] drives everything — the [BunFace] state machine, the idle
/// breath, and the typewriter whose every grapheme feeds the mouth. The base
/// frame stays fully opaque and the other two only fade in on top: cross-fading
/// two frames of the same body dips its alpha and reads as a flicker.
class BunMascot extends StatefulWidget {
  const BunMascot({super.key, this.size = 84, required this.speech});

  /// The bun's WIDTH; the height follows from [kBunFrameAspect].
  final double size;

  /// The line the bubble speaks.
  final String speech;

  /// Test hook: a seeded [math.Random] makes the blink schedule deterministic.
  @visibleForTesting
  static math.Random? debugRandom;

  @override
  State<BunMascot> createState() => _BunMascotState();
}

class _BunMascotState extends State<BunMascot>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker(_onTick);
  late final BunFace _face = BunFace(random: BunMascot.debugRandom);

  /// The idle breath, OUTSIDE `setState`: a 60fps rebuild of the mascot, its
  /// bubble and the band buys nothing for a scale that wraps three images. The
  /// notifier repaints the [Transform.scale] alone.
  final ValueNotifier<double> _breath = ValueNotifier<double>(1);

  List<String> _chars = const [];
  Duration _elapsed = Duration.zero;
  Duration _nextChar = kBunChar;
  int _shown = 0;
  bool _caretOn = true;
  bool _precached = false;
  bool _reduceMotion = false;

  /// Frames decoded at the size they are DRAWN, not at their 360px source.
  int get _cacheWidth =>
      (widget.size * MediaQuery.devicePixelRatioOf(context)).round();

  /// Reduced motion drops the typing and the breath (the blink cycle stays —
  /// a face that never blinks reads as dead): the line is up from build one.
  int get _revealed => _reduceMotion ? _chars.length : _shown;

  @override
  void initState() {
    super.initState();
    _chars = widget.speech.characters.toList();
    _ticker.start();
  }

  @override
  void didUpdateWidget(BunMascot old) {
    super.didUpdateWidget(old);
    // The line CAN change under a live mascot: screen 1's language toggle
    // re-translates the same guide string. Retype it from the top.
    if (old.speech == widget.speech) return;
    setState(() {
      _chars = widget.speech.characters.toList();
      _shown = 0;
      _nextChar = _elapsed + kBunChar;
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = MediaQuery.disableAnimationsOf(context);
    if (_precached) return;
    _precached = true;
    for (final frame in const [kBunBaseFrame, kBunWideFrame, kBunBlinkFrame]) {
      precacheImage(
        // Same provider `Image.asset(cacheWidth:)` builds below, so the warm
        // entry is the one the frames actually go looking for.
        ResizeImage(AssetImage(frame), width: _cacheWidth),
        context,
        // A missing frame is cosmetic; unhandled it is rethrown into
        // `FlutterError.onError` and reported as a crash.
        onError: (error, _) => developer.log(
          'bun frame $frame did not precache: $error',
          name: 'mascot.bun',
        ),
      );
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _breath.dispose();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    _elapsed = elapsed;
    final phase =
        2 * math.pi * elapsed.inMilliseconds / kBunBreath.inMilliseconds;
    _breath.value =
        _reduceMotion ? 1.0 : 1 + kBunBreathAmplitude * (1 - math.cos(phase));
    // The face first: `speak` reads the clock `tick` just set, and a pending
    // blink has to swallow the viseme rather than land on top of it.
    var changed = _face.tick(elapsed);
    if (!_reduceMotion && _type(elapsed)) changed = true;
    if (changed) setState(() {});
  }

  /// Reveals what [elapsed] has earned, blinks the caret; true when it shows.
  bool _type(Duration elapsed) {
    var changed = false;
    while (_shown < _chars.length && elapsed >= _nextChar) {
      final cluster = _chars[_shown++];
      _face.speak(cluster);
      _nextChar += _isPunctuation(cluster) ? kBunChar + kBunPunctuation : kBunChar;
      changed = true;
    }
    final caretOn =
        elapsed.inMilliseconds % kBunCaret.inMilliseconds <
        kBunCaret.inMilliseconds ~/ 2;
    if (caretOn != _caretOn && _shown < _chars.length) {
      _caretOn = caretOn;
      changed = true;
    }
    return changed;
  }

  static bool _isPunctuation(String cluster) => '.,!?;:…'.contains(cluster);

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: widget.size,
          height: widget.size / kBunFrameAspect,
          // The scale is the ONLY thing the breath drives, so the three frames
          // travel as `child:` and are not rebuilt per frame.
          child: ValueListenableBuilder<double>(
            valueListenable: _breath,
            builder: (context, breath, child) => Transform.scale(
              scale: breath,
              alignment: Alignment.bottomCenter, // it breathes off its feet
              child: child,
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                _frame('base', kBunBaseFrame, 1),
                _frame('wide', kBunWideFrame, _face.wide ? 1 : 0),
                _frame('blink', kBunBlinkFrame, _face.lid),
              ],
            ),
          ),
        ),
        const SizedBox(width: KalloSpacing.sp3),
        Expanded(
          child: GuideBubble(
            text: widget.speech,
            revealed: _revealed,
            caretOn: _caretOn,
          ),
        ),
      ],
    );
  }

  Widget _frame(String name, String asset, double opacity) => Opacity(
    key: ValueKey('bunFrame.$name'),
    opacity: opacity,
    child: Image.asset(
      asset,
      fit: BoxFit.contain,
      cacheWidth: _cacheWidth,
      gaplessPlayback: true,
      excludeFromSemantics: true,
    ),
  );
}
