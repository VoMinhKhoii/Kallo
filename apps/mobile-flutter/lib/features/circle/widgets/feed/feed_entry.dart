import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_time.dart';
import 'feed_entry_actions.dart';
import 'share_replies.dart';

/// Vertical rhythm, ink-to-ink.
///
/// Two values do all the work — [_tight] binds a label to the thing it labels,
/// [_standard] separates one cluster from the next AND doubles as the post's
/// padding. Threads runs the same shape at 8/16; this is that discipline at our
/// density.
///
/// Gaps are measured between what the eye sees, not between widget boxes. The
/// action row is a 44pt tap target wrapped around a 16pt glyph, so it already
/// carries ~14pt of slack above and below its ink — that slack IS the gap on
/// either side of it. Adding a [SizedBox] there would render as ~26.
const double _tight = KalloSpacing.sp1; // 4
const double _standard = KalloSpacing.sp3; // 12

/// How much of the nutrition page's bar this surface spends.
///
/// That page draws one bar per screen; the feed draws one per post, so the same
/// mark repeated down a list read as candy stripes at full weight. Half the
/// height, a visible gutter between segments, and pigment pulled back toward
/// the page — the three knobs to reach for if it still reads heavy, before
/// touching the palette itself.
const double _barHeight = 4;
const double _barGap = 2;
const double _barOpacity = 0.8;

/// One shared meal: who and when, the meal itself, its calories and macro
/// composition, then the action row.
class FeedEntry extends StatefulWidget {
  const FeedEntry({required this.entry, super.key});

  final CircleFeedEntry entry;

  @override
  State<FeedEntry> createState() => _FeedEntryState();
}

class _FeedEntryState extends State<FeedEntry> {
  /// Owned here rather than in [ShareReplies] because the trigger lives in the
  /// action row: the two are siblings, so their common parent holds the state.
  bool _replyOpen = false;

  String _fraction(double factor) {
    if ((factor - 0.5).abs() < 0.001) return '½';
    if ((factor - 1 / 3).abs() < 0.001) return '⅓';
    if ((factor - 0.25).abs() < 0.001) return '¼';
    return '${(factor * 100).round()}%';
  }

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    final meal = entry.meal;
    final name = entry.isSelf ? tr('groups.wall.you') : entry.friend.label;
    final sharedAt = DateTime.parse(meal.sharedAt);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileAvatarDisc(profile: entry.friend, size: 36),
        const SizedBox(width: KalloSpacing.sp3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: KalloSpacing.sp2,
                runSpacing: 3,
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: name,
                          // Bold + ink against the muted timestamp beside it:
                          // the Threads relationship, where a bold author sits
                          // over regular body copy. w600 is above the w500 that
                          // `mobile.md` caps DATA at — a name is identity, not
                          // a figure, and the cap exists to stop numbers
                          // shouting at each other.
                          style: dashMeta(
                            weight: FontWeight.w600,
                          ).copyWith(color: kInk),
                        ),
                        // A backfilled (past-date) meal shared "now" would
                        // misleadingly read "just now" — hide the elapsed time.
                        // Mirrors web `components/groups/feed-entry.tsx`.
                        if (!meal.isBackfilled)
                          TextSpan(
                            text:
                                ' · ${formatElapsed(sharedAt, locale: context.locale.languageCode)}',
                            style: dashMeta(),
                          ),
                      ],
                    ),
                  ),
                  if (meal.portionFactor < 1)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: KalloSpacing.sp2,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: kTrack,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        tr(
                          'groups.feed.portion',
                          namedArgs: {'portion': _fraction(meal.portionFactor)},
                        ),
                        style: dashMeta(),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: _tight),
              // The hero: the only ink-coloured body text on the post.
              Text(meal.rawInput, style: dashBody()),
              const SizedBox(height: _standard),
              _Nutrition(meal: meal),
              // No gap: the action row's own tap slack supplies it.
              FeedEntryActions(
                entry: entry,
                onReply: () => setState(() => _replyOpen = true),
              ),
              ShareReplies(
                shareId: meal.shareId,
                replies: entry.replies,
                repliesTotal: entry.repliesTotal,
                open: _replyOpen,
                onClose: () {
                  if (mounted) setState(() => _replyOpen = false);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Calories and macros on one line, over the stacked composition bar.
///
/// The calorie figure sits at Body in medium ink; its unit and the macro grams
/// stay at Meta, so the number carries the mass rather than the word without
/// outweighing the meal name above it. The bar splits by CALORIE share, so a
/// low-gram/high-energy fat slice reads at its true weight.
class _Nutrition extends StatelessWidget {
  const _Nutrition({required this.meal});

  final CircleFeedMeal meal;

  @override
  Widget build(BuildContext context) {
    final composition = compositionFromGrams(
      protein: meal.proteinG,
      carbohydrate: meal.carbohydrateG,
      fat: meal.fatG,
    );
    final kcal = meal.caloriesKcal;
    // Nothing measured at all — draw nothing rather than a row of dashes over
    // an empty bar.
    if (kcal == null && composition.totalKcal <= 0) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            // Unit stays at Meta so the figure carries the mass, not the word.
            style: dashMeta(),
            children: [
              TextSpan(
                text: kcal == null ? '—' : '${kcal.round()}',
                // Body, not Value: at 17 the figure outweighed the meal name
                // above it, which put the post's focus back on the number this
                // redesign had just taken it off. Medium weight and ink still
                // mark it as the figure.
                style: dashBody(weight: FontWeight.w500, tabular: true),
              ),
              const TextSpan(text: ' kcal'),
            ],
          ),
        ),
        if (composition.totalKcal > 0) ...[
          const SizedBox(height: _tight),
          CompositionBar(
            segments: composition.segments,
            height: _barHeight,
            gap: _barGap,
            opacity: _barOpacity,
          ),
          const SizedBox(height: _tight),
        ],
        _MacroScale(segments: composition.segments, meal: meal),
      ],
    );
  }
}

/// The macro figures, each centred under its own slice of the bar above.
///
/// The row mirrors the bar's flex weights and gutter exactly, so a label tracks
/// its segment as the split changes — the bar becomes its own legend and the
/// colour stops being encoded twice.
///
/// Two cases break that alignment, and both fall back to a plain left-aligned
/// run instead of misreporting: a macro with no value has no slice to sit
/// under, and a meal with no figures at all has no bar.
class _MacroScale extends StatelessWidget {
  const _MacroScale({required this.segments, required this.meal});

  final List<CompositionSegment> segments;
  final CircleFeedMeal meal;

  static String _grams(double? value) =>
      value == null ? '—' : '${value.round()}g';

  double? _gramsFor(String key) => switch (key) {
    'protein' => meal.proteinG,
    'carbohydrate' => meal.carbohydrateG,
    _ => meal.fatG,
  };

  String _labelFor(String key) => switch (key) {
    'protein' => 'P',
    'carbohydrate' => 'C',
    _ => 'F',
  };

  Widget _value(String key) => _MacroValue(
    icon: kMacroIcons[key]!,
    color: kCompositionColors[key]!,
    label: _labelFor(key),
    value: _grams(_gramsFor(key)),
  );

  @override
  Widget build(BuildContext context) {
    final visible = segments.where((segment) => segment.pct > 0).toList();
    if (visible.length != kCompositionKeys.length) {
      return Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: KalloSpacing.sp3,
        runSpacing: _tight,
        children: [for (final key in kCompositionKeys) _value(key)],
      );
    }
    return Row(
      children: [
        for (var i = 0; i < visible.length; i++) ...[
          if (i > 0) const SizedBox(width: _barGap),
          Expanded(
            flex: (visible[i].pct * 1000).round(),
            // A thin slice cannot hold its label at Meta. Scaling down beats
            // dropping the figure or letting it run into its neighbour — the
            // same trade `day_summary.dart` makes for its macro rows.
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: _value(visible[i].key),
            ),
          ),
        ],
      ],
    );
  }
}

/// One macro: its food glyph in the macro's own pigment, then the grams. The
/// glyph sits at 14 — the in-text-run exception to the app-wide 24 — because it
/// reads as punctuation inside the line, not as an icon beside it.
class _MacroValue extends StatelessWidget {
  const _MacroValue({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 14, color: color),
      const SizedBox(width: KalloSpacing.sp1_5),
      Text('$label $value', style: dashMeta(tabular: true)),
    ],
  );
}
