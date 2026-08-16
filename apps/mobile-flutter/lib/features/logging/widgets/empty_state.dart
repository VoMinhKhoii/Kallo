import 'dart:math';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/kallo_mark.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../circle/data/circle_providers.dart';
import 'entrances.dart';

/// The prompt buckets, in the order the day runs through them. Each bucket has
/// three phrasings; one is drawn per visit so an empty day never feels canned.
///
/// Every phrasing ships TWICE: `<bucket><n>` (name-less) and `<bucket><n>Named`
/// (with `{name}`). The name-less form is the one that always works, so the
/// prompt can render on the very first frame — the display name arrives over
/// the network and may never arrive at all.
const _prompts = <String, int>{
  'morning': 3,
  'lunch': 3,
  'afternoon': 3,
  'evening': 3,
  'lateNight': 3,
};

/// Which bucket [hour] (0–23) falls in. Late night is the wrap-around case:
/// everything from 22:00 until breakfast starts.
String _bucketForHour(int hour) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'lateNight';
}

/// The empty feed: the Kallo mark, bare — no plate, no tile — over a single
/// serif question tuned to the time of day, and to the person when we know who
/// they are. This is the logging tab's one editorial moment; the rest of the
/// surface is sans-serif data.
class EmptyState extends ConsumerStatefulWidget {
  const EmptyState({super.key});

  @override
  ConsumerState<EmptyState> createState() => _EmptyStateState();
}

class _EmptyStateState extends ConsumerState<EmptyState> {
  /// Drawn ONCE, in initState: the display name lands a frame or two later and
  /// rebuilds us, and a prompt that reshuffled at that moment would read as a
  /// glitch rather than a greeting.
  late final String _key = _drawKey();

  static String _drawKey() {
    final bucket = _bucketForHour(DateTime.now().hour);
    final index = Random().nextInt(_prompts[bucket]!) + 1;
    return 'logging.emptyState.$bucket$index';
  }

  /// The name to greet, or null when we should stay impersonal. Long or
  /// multi-word labels collapse to the first word — "Time for lunch, Khoa"
  /// reads like a person talking; the full legal name does not.
  String? get _name {
    // Never awaited: loading and error both surface as null, and the name-less
    // prompt is already on screen by then.
    final label = ref.watch(myCircleProfileProvider).valueOrNull?.label.trim();
    if (label == null || label.isEmpty) return null;
    final first = label.split(RegExp(r'\s+')).first;
    return (first.isEmpty || first.length > 16) ? null : first;
  }

  @override
  Widget build(BuildContext context) {
    final name = _name;
    final prompt = name == null
        ? _key.tr()
        : '${_key}Named'.tr(namedArgs: {'name': name});

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // The mark stands on the page itself, no plate behind it.
          const ZoomIn(
            delay: Duration(milliseconds: 50),
            // Ink, the same tint the sidebar's wordmark carries by default —
            // the mark reads as the brand, not as an accent decoration.
            child: KalloMark(height: 28, color: kInk),
          ),
          const SizedBox(height: KalloSpacing.sp5),
          FadeInDown(
            delay: const Duration(milliseconds: 100),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp6),
              child: Text(
                prompt,
                textAlign: TextAlign.center,
                style: dashHeadline(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
