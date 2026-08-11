import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';
import '../../logic/feed/stream_ticker.dart';
import '../loaders/loader_registry.dart';
import 'ticker_flip.dart';

/// The ONE loading state while a meal analyses: a loader picked for this run
/// and a single line of text that flips as the pipeline progresses — stage
/// label, then dish names as they're detected, then dishes with their calories.
///
/// Ported from the web dashboard/circle meal bar
/// (`components/dashboard/today/meal-trigger.tsx`), which turns the input bar
/// itself into the stream. Same 32px loader box, same `gap-3`, same one-line
/// truncation.
class StreamTickerLine extends StatelessWidget {
  const StreamTickerLine({
    super.key,
    required this.frame,
    required this.loaderIndex,
  });

  /// Null falls back to the generic "Analyzing…" line.
  final StreamTickerFrame? frame;

  /// Index into `kSvgLoaders`, picked once per meal and held for the whole run.
  final int loaderIndex;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox.square(
          dimension: NhamSpacing.sp8, // 32 — the web h-8 w-8 box
          child: Center(
            child: SvgLoaderView(spec: loaderAt(loaderIndex), size: 20),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3), // gap-3
        Expanded(
          child: Semantics(
            liveRegion: true,
            child: TickerFlip(
              frameKey: frame?.key ?? 'analyzing',
              child: _TickerText(frame: frame),
            ),
          ),
        ),
      ],
    );
  }
}

/// One rendered frame.
///
/// Type diverges from web deliberately in ONE respect: web sizes this line at
/// `text-sm` throughout and so do we (14, not the 12 the old phase caption
/// used), because this line is now the entire loading state rather than a
/// caption beneath a card — and because a phase frame and an item frame must
/// be the same height or the flip changes the row's height mid-animation.
class _TickerText extends StatelessWidget {
  const _TickerText({required this.frame});

  final StreamTickerFrame? frame;

  @override
  Widget build(BuildContext context) {
    final phaseStyle = dashBody(color: kInkMuted);
    // The meal's own words, as on web: serif italic in primary ink. Explicitly
    // NOT NhamTextVariant.italicAccent, which is Lora italic in TAN — the
    // palette rule is that tan never colours running text.
    final wordsStyle = NhamTextStyles.serifItalic(
      fontSize: 14,
      height: 1.3,
    ).copyWith(color: kInk);

    final (TextSpan span) = switch (frame) {
      MacrosFrame(:final name, :final calories) => TextSpan(
        style: wordsStyle,
        text: name,
        children: [
          TextSpan(
            // Non-italic, muted, tabular — the resolved number reads as data,
            // not as part of the dish's name. fontStyle must be set BACK to
            // normal explicitly: a child span merges onto its parent, so the
            // serif italic above would otherwise leak into the kcal.
            style: dashBody(
              color: kInkMuted,
              tabular: true,
            ).copyWith(fontStyle: FontStyle.normal),
            text: ' · $calories ${'logging.cheatSliders.kcal'.tr()}',
          ),
        ],
      ),
      ItemFrame(:final name) => TextSpan(style: wordsStyle, text: '$name…'),
      PhaseFrame(:final labelKey) => TextSpan(
        style: phaseStyle,
        text: labelKey.tr(),
      ),
      null => TextSpan(
        style: phaseStyle,
        text: 'logging.streaming.analyzing'.tr(),
      ),
    };

    return Text.rich(span, maxLines: 1, overflow: TextOverflow.ellipsis);
  }
}
