import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../models/streaming.dart';
import '../../logic/feed/stage_verbs.dart';
import '../../logic/feed/stream_ticker.dart';
import '../loaders/loader_registry.dart';
import 'ticker_flip.dart';
import 'ticker_text.dart';

/// How long one action verb holds before the line flips to the next.
///
/// The flip itself eats 360ms of this (180 out, 180 in), so the verb is only
/// STILL for dwell − 360. At 1600 that left ~1.24s of settled reading and the
/// line felt hurried; 2400 gives just over two seconds, which also suits the
/// longer Vietnamese verbs.
const Duration _verbDwell = Duration(milliseconds: 2400);

/// The ONE loading state while a meal analyses: a loader picked for this run
/// and a single line that flips through action verbs, then through dish names
/// as they are detected, then dishes with their calories.
///
/// Ported from the web dashboard/circle meal bar
/// (`components/dashboard/today/meal-trigger.tsx`) — same 32px loader box, same
/// `gap-3`, same one-line truncation — with the verbs and the brand brown on
/// top of it.
class StreamTickerLine extends StatefulWidget {
  const StreamTickerLine({
    super.key,
    required this.frame,
    required this.status,
    required this.loaderIndex,
  });

  /// Null falls back to the generic analyzing verbs.
  final StreamTickerFrame? frame;

  /// The stage the pipeline is actually in. Needed even when [frame] is a dish:
  /// the line falls back to this stage's verbs between dishes, and without it
  /// the first name detected during `decomposing` would hold the line for the
  /// rest of the run.
  final StreamStatus status;

  /// Index into `kSvgLoaders`, picked once per meal and held for the whole run.
  final int loaderIndex;

  @override
  State<StreamTickerLine> createState() => _StreamTickerLineState();
}

class _StreamTickerLineState extends State<StreamTickerLine> {
  Timer? _timer;

  final StageVerbs _verbs = StageVerbs();

  /// Which verb of the current stage is showing. Advances every dwell.
  int _verb = 0;

  /// True for the one dwell after a dish lands, while the line is showing that
  /// dish rather than a verb.
  bool _showingItem = false;

  bool get _hasItem =>
      widget.frame is ItemFrame || widget.frame is MacrosFrame;

  bool get _reduceMotion => MediaQuery.disableAnimationsOf(context);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _showingItem = _hasItem;
    _sync();
  }

  @override
  void didUpdateWidget(covariant StreamTickerLine oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) {
      // A new stage restarts its own set rather than continuing the last one's
      // rotation, so every stage opens on its first, most literal verb.
      _verb = 0;
    }
    if (oldWidget.frame?.key != widget.frame?.key && _hasItem) {
      // A dish just landed. Interrupt whatever verb was showing and give it the
      // line — that is the only genuinely new information on screen.
      _showingItem = true;
      _sync(restart: true);
      return;
    }
    _sync();
  }

  /// Runs for the WHOLE run, not just while a verb shows: the same tick is what
  /// hands the line back from a dish to the stage's verbs. [restart] re-bases
  /// the dwell so a dish gets a full one.
  void _sync({bool restart = false}) {
    if (_reduceMotion) {
      _timer?.cancel();
      _timer = null;
      return;
    }
    if (restart) _timer?.cancel();
    if (restart || _timer == null) {
      _timer = Timer.periodic(_verbDwell, (_) => _tick());
    }
  }

  void _tick() {
    if (!mounted) return;
    setState(() {
      if (_showingItem) {
        // The dish has had its dwell; hand the line back to the stage's verbs.
        _showingItem = false;
      } else {
        _verb++;
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// The verb showing for this stage, and the key that identifies it.
  ///
  /// Falls back to the stage's flat single-string label when its verb keys are
  /// missing — `tr` returns the key itself for an unknown key, so a bad l10n
  /// edit degrades to the previous copy rather than printing a raw key.
  /// The verb showing for this stage, and the key that identifies it.
  ///
  /// Falls back to the stage's flat single-string label when the locale has no
  /// verbs for it, so a bad l10n edit degrades to the previous copy rather than
  /// printing a raw key.
  (String text, String key) _phaseText(String labelKey) {
    final stage = labelKey.split('.').last;
    final verbs = _verbs.forStage(stage, context.locale);
    if (verbs.isEmpty) return (labelKey.tr(), '$labelKey-0');
    final i = _verb % verbs.length;
    return (verbs[i], '$labelKey-$i');
  }

  @override
  Widget build(BuildContext context) {
    final (line, key, prefix) = _resolve();
    return Row(
      children: [
        SizedBox.square(
          dimension: NhamSpacing.sp8, // 32 — the web h-8 w-8 box
          child: Center(
            child: SvgLoaderView(
              spec: loaderAt(widget.loaderIndex),
              size: 20,
              // The brand brown: the loader and the verb beside it are the app
              // working, so they carry the logo's umber rather than muted ink.
              color: NhamColors.btn,
            ),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3), // gap-3
        Expanded(
          child: Semantics(
            liveRegion: true,
            child: TickerFlip(frameKey: key, prefix: prefix, child: line),
          ),
        ),
      ],
    );
  }

  (Widget, String, Widget?) _resolve() {
    // Under reduced motion nothing rotates, so the dish — the informative half
    // — is what the line settles on whenever there is one.
    final frame = widget.frame;
    if ((_showingItem || (_reduceMotion && _hasItem)) && frame != null) {
      // A dish is the meal's own words — no "Đang" belongs in front of it.
      return (TickerText.dish(frame), frame.key, null);
    }
    // Otherwise: the verb for whatever stage the pipeline is actually in — even
    // when `frame` is a dish, which is what makes the matching and estimating
    // verbs reachable at all.
    final (text, key) = _phaseText(phaseLabelKey(widget.status));
    final prefix = _verbs.prefix;
    return (
      TickerText.verb(text),
      key,
      prefix.isEmpty ? null : TickerText.verb('$prefix '),
    );
  }
}
