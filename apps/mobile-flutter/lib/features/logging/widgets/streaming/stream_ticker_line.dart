import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';
import '../../logic/feed/stream_ticker.dart';
import '../loaders/loader_registry.dart';
import 'ticker_flip.dart';

/// How long one action verb holds before the line flips to the next.
const Duration _verbDwell = Duration(milliseconds: 1600);

/// How many numbered `verbs.<stage>N` keys to look for. Probing stops early at
/// the first missing key, so a stage may carry fewer — but not more without
/// raising this, and easy_localization logs a warning for every miss, so it is
/// deliberately the exact count the locale files ship rather than a loose cap.
const int _maxVerbsPerStage = 3;

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
    required this.loaderIndex,
  });

  /// Null falls back to the generic analyzing verbs.
  final StreamTickerFrame? frame;

  /// Index into `kSvgLoaders`, picked once per meal and held for the whole run.
  final int loaderIndex;

  @override
  State<StreamTickerLine> createState() => _StreamTickerLineState();
}

class _StreamTickerLineState extends State<StreamTickerLine> {
  Timer? _timer;

  /// Which verb of the current stage is showing. Advances on the timer so a
  /// slow stage still reads as working; a dish frame is real news and freezes
  /// it, so the pipeline's own progress always wins the line.
  int _verb = 0;

  bool get _isPhase => widget.frame is PhaseFrame || widget.frame == null;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(covariant StreamTickerLine oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A new stage restarts its own set rather than continuing the last one's
    // rotation, so every stage opens on its first, most literal verb.
    if (oldWidget.frame?.key != widget.frame?.key && _isPhase) _verb = 0;
    _sync();
  }

  void _sync() {
    final wanted = _isPhase && !MediaQuery.disableAnimationsOf(context);
    if (wanted == (_timer != null)) return;
    _timer?.cancel();
    _timer = wanted
        ? Timer.periodic(_verbDwell, (_) {
            if (mounted) setState(() => _verb++);
          })
        : null;
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
  (String text, String key) _phaseText(String labelKey) {
    final stage = labelKey.split('.').last;
    final verbs = <String>[];
    for (var i = 1; i <= _maxVerbsPerStage; i++) {
      final key = 'logging.streaming.verbs.$stage$i';
      final value = key.tr();
      if (value == key) break;
      verbs.add(value);
    }
    if (verbs.isEmpty) return (labelKey.tr(), '$labelKey-0');
    final i = _verb % verbs.length;
    return (verbs[i], '$labelKey-$i');
  }

  @override
  Widget build(BuildContext context) {
    final (line, key) = _resolve();
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
            child: TickerFlip(frameKey: key, child: line),
          ),
        ),
      ],
    );
  }

  (Widget, String) _resolve() {
    final frame = widget.frame;
    // The meal's own words, as on web: serif italic in primary ink. NOT
    // NhamTextVariant.italicAccent, which is Lora italic in TAN — the palette
    // rule is that tan never colours running text.
    final words = NhamTextStyles.serifItalic(
      fontSize: 14,
      height: 1.3,
    ).copyWith(color: kInk);

    switch (frame) {
      case MacrosFrame(:final name, :final calories):
        return (
          _line(
            TextSpan(
              style: words,
              text: name,
              children: [
                TextSpan(
                  // fontStyle back to normal explicitly: a child span merges
                  // onto its parent, so the italic above would otherwise leak
                  // into the kcal.
                  style: dashBody(
                    color: kInkMuted,
                    tabular: true,
                  ).copyWith(fontStyle: FontStyle.normal),
                  text: ' · $calories ${'logging.cheatSliders.kcal'.tr()}',
                ),
              ],
            ),
          ),
          frame.key,
        );
      case ItemFrame(:final name):
        return (_line(TextSpan(style: words, text: '$name…')), frame.key);
      case PhaseFrame(:final labelKey):
        final (text, key) = _phaseText(labelKey);
        return (_line(TextSpan(style: _verbStyle, text: text)), key);
      case null:
        final (text, key) = _phaseText('logging.streaming.analyzing');
        return (_line(TextSpan(style: _verbStyle, text: text)), key);
    }
  }

  /// Action verbs sit at Body 14 like the dish frames, so the row never changes
  /// height mid-flip, and in umber so "working" reads as the app's own voice.
  TextStyle get _verbStyle =>
      dashBody(color: NhamColors.btn, weight: FontWeight.w500);

  Widget _line(TextSpan span) =>
      Text.rich(span, maxLines: 1, overflow: TextOverflow.ellipsis);
}
