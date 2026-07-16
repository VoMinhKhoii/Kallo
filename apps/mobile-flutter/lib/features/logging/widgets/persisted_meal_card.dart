import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../data/env.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../../circle/data/circle_providers.dart';
import '../../circle/widgets/share_meal_sheet.dart';
import '../data/logging_models.dart';
import '../logic/format.dart';

/// A saved meal in the day's feed — collapsed by default, expandable.
///
/// Ported 1:1 from
/// `apps/mobile/src/components/logging/feed/persisted-meal-card.tsx`: the
/// chevron rotates 0°↔180° (200ms), the collapsed summary cross-fades out, and
/// the detail block animates its height open/closed (200ms).
class PersistedMealCard extends StatefulWidget {
  const PersistedMealCard({
    super.key,
    required this.meal,
    this.isLast = false,
    this.onRemove,
  });

  final PersistedMeal meal;
  final bool isLast;

  /// iOS trailing-swipe removal (terracotta, never red) — fired when the card is
  /// dismissed. Null disables the swipe.
  final VoidCallback? onRemove;

  @override
  State<PersistedMealCard> createState() => _PersistedMealCardState();
}

class _PersistedMealCardState extends State<PersistedMealCard>
    with SingleTickerProviderStateMixin {
  bool _collapsed = true;

  // expandProgress 0 (collapsed) → 1 (expanded), 200ms.
  late final AnimationController _expand = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
  );

  void _toggle() {
    setState(() => _collapsed = !_collapsed);
    if (_collapsed) {
      _expand.reverse();
    } else {
      _expand.forward();
    }
  }

  @override
  void dispose() {
    _expand.dispose();
    super.dispose();
  }

  /// Wrap the card in a trailing-swipe-to-remove Dismissible (terracotta, never
  /// red) when [onRemove] is set; otherwise return the card untouched.
  Widget _maybeDismissible(Widget card) {
    final onRemove = widget.onRemove;
    if (onRemove == null) return card;
    return Dismissible(
      key: ValueKey('dismiss-${widget.meal.id}'),
      direction: DismissDirection.endToStart,
      onDismissed: (_) {
        HapticFeedback.mediumImpact();
        onRemove();
      },
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp5),
        decoration: BoxDecoration(
          color: NhamColors.danger,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.trash2, size: 18, color: Colors.white),
            const SizedBox(width: 6),
            NhamText(
              'logging.remove'.tr(),
              variant: NhamTextVariant.body,
              style: dashBody(color: Colors.white, weight: FontWeight.w500),
            ),
          ],
        ),
      ),
      child: card,
    );
  }

  @override
  Widget build(BuildContext context) {
    final meal = widget.meal;
    final n = meal.nutrition;
    final time = DateFormat.jm(context.locale.toString())
        .format(DateTime.parse(meal.loggedAt).toLocal());

    // Details height open/close: 200ms ease-in-out (persisted-meal-card.tsx:231).
    final curvedExpand = CurvedAnimation(
      parent: _expand,
      curve: Curves.easeInOut,
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp3), // mb-3
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Time as a centered divider on top of the card (── 1:04 AM ──) —
            // no left timeline gutter, so the card gets the full row width.
            _TimeDivider(time: time),
            const SizedBox(height: NhamSpacing.sp2), // mb-2
            _maybeDismissible(
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header — the whole row is the toggle target (not just the
                  // ~24px chevron), so the comfortable tap area spans the quote.
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _toggle,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: NhamText(
                            meal.rawInput,
                            variant: NhamTextVariant.mealQuote,
                            style: const TextStyle(
                              fontSize: 17,
                              height: 28 / 17, // leading-7 (28px)
                            ),
                          ),
                        ),
                        const SizedBox(width: NhamSpacing.sp3), // gap-3
                        _ChevronToggle(
                          expand: _expand,
                          onTap: _toggle,
                        ),
                      ],
                    ),
                  ),

                  // Collapsed summary — fades + collapses height as it expands.
                  AnimatedBuilder(
                    animation: curvedExpand,
                    builder: (context, child) {
                      final t = curvedExpand.value;
                      // Summary cross-fade runs at 150ms (faster than the
                      // 200ms height) — fade out within the first 0.75 of the
                      // open progress.
                      final fade = (1 - (t / 0.75)).clamp(0.0, 1.0);
                      return ClipRect(
                        child: Align(
                          heightFactor: (1 - t),
                          child: Opacity(opacity: fade, child: child),
                        ),
                      );
                    },
                    child: Padding(
                      padding:
                          const EdgeInsets.only(top: NhamSpacing.sp2), // mt-2
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          NhamText(
                            'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}',
                            variant: NhamTextVariant.captionTabular,
                          ),
                          NhamText(
                            fmtKcal(n.caloriesKcal),
                            variant: NhamTextVariant.numStrong,
                            style: dashValue(),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Expanded details — animate height open (easeInOut).
                  SizeTransition(
                    sizeFactor: curvedExpand,
                    alignment: Alignment.topCenter,
                    child: FadeTransition(
                      opacity: curvedExpand,
                      child: _ExpandedDetails(meal: meal),
                    ),
                  ),

                  // Actions: "Share with friends" (copy/split) on the left, the
                  // per-meal circle-share toggle on the right (web parity).
                  Padding(
                    padding: const EdgeInsets.only(top: NhamSpacing.sp3),
                    child: Row(
                      children: [
                        if (meal.mealItemGroups.isNotEmpty)
                          _ShareWithFriendsButton(mealId: meal.id),
                        const Spacer(),
                        _ShareToCircleButton(
                          mealId: meal.id,
                          share: meal.share,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            ),
          ],
        ),
      );
  }
}

/// Centered time divider that sits on top of a meal card: a hairline, the time
/// (── 1:04 AM ──), and a hairline — replacing the old left-rail time label.
class _TimeDivider extends StatelessWidget {
  const _TimeDivider({required this.time});

  final String time;

  @override
  Widget build(BuildContext context) {
    const line = Expanded(
      child: Divider(
        color: NhamColors.borderFaint,
        height: 1,
        thickness: 1,
      ),
    );
    return Row(
      children: [
        line,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
          child: NhamText(time, variant: NhamTextVariant.timeLabel),
        ),
        line,
      ],
    );
  }
}

/// The collapse chevron: its OWN button — rounded-full p-1, text-muted/60,
/// pressed bg-nham-hover/40 + text-nham-text (web hover affordance). Rotates
/// 0°↔180° over 200ms.
class _ChevronToggle extends StatefulWidget {
  const _ChevronToggle({required this.expand, required this.onTap});

  final Animation<double> expand;
  final VoidCallback onTap;

  @override
  State<_ChevronToggle> createState() => _ChevronToggleState();
}

class _ChevronToggleState extends State<_ChevronToggle> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150), // transition-colors
        padding: const EdgeInsets.all(4), // p-1
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.hover40 : Colors.transparent,
          shape: BoxShape.circle,
        ),
        child: RotationTransition(
          turns: Tween<double>(begin: 0, end: 0.5).animate(widget.expand),
          child: Icon(
            LucideIcons.chevronDown, // lucide ChevronDown
            size: 16,
            color: _pressed ? NhamColors.text : NhamColors.textMuted60,
          ),
        ),
      ),
    );
  }
}

class _ExpandedDetails extends StatelessWidget {
  const _ExpandedDetails({required this.meal});
  final PersistedMeal meal;

  @override
  Widget build(BuildContext context) {
    final n = meal.nutrition;
    final groups = [...meal.mealItemGroups]
      ..sort((a, b) => a.order.compareTo(b.order));
    return Padding(
      padding: const EdgeInsets.only(top: NhamSpacing.sp5), // mt-5
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 1, thickness: 1, color: NhamColors.borderFaint),
          const SizedBox(height: NhamSpacing.sp4), // pt-4
          Padding(
            padding: const EdgeInsets.only(bottom: NhamSpacing.sp4), // mb-4
            child: Column(
              children: [
                for (final group in groups)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8), // py-2
                    child: Row(
                      children: [
                        Expanded(
                          child: NhamText(
                            group.name,
                            variant: NhamTextVariant.itemName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: NhamSpacing.sp3), // gap-3
                        Row(
                          children: [
                            NhamText('P: ${fmtG(group.nutrition.proteinG)}',
                                variant: NhamTextVariant.macroTiny),
                            const SizedBox(width: NhamSpacing.sp2),
                            NhamText(
                                'C: ${fmtG(group.nutrition.carbohydrateG)}',
                                variant: NhamTextVariant.macroTiny),
                            const SizedBox(width: NhamSpacing.sp2),
                            NhamText('F: ${fmtG(group.nutrition.fatG)}',
                                variant: NhamTextVariant.macroTiny),
                            const SizedBox(width: NhamSpacing.sp3), // gap-3
                            NhamText(
                              fmtKcal(group.nutrition.caloriesKcal),
                              variant: NhamTextVariant.calorieBold,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 1, color: NhamColors.borderFaint),
          const SizedBox(height: NhamSpacing.sp3), // pt-3
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              NhamText('logging.persistedMealCard.total'.tr(),
                  variant: NhamTextVariant.calorieBold),
              Row(
                children: [
                  NhamText(
                    'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}',
                    variant: NhamTextVariant.captionTabular,
                  ),
                  const SizedBox(width: NhamSpacing.sp4), // gap-4
                  NhamText(fmtKcal(n.caloriesKcal),
                      variant: NhamTextVariant.numStrong),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The per-meal "Share to circle" toggle plus, once shared, the "Share card"
/// action (the shareable Macro Card link). Optimistically flips its own state,
/// calls `POST /api/v1/groups/shares`, and reverts + toasts on failure.
/// Re-seeds from the server payload when the day refetches. Mirrors the web
/// `ShareToCircleButton` + `ShareCardButton` in `persisted-meal-card.tsx`.
class _ShareToCircleButton extends ConsumerStatefulWidget {
  const _ShareToCircleButton({required this.mealId, required this.share});

  final String mealId;
  final MealShare? share;

  @override
  ConsumerState<_ShareToCircleButton> createState() =>
      _ShareToCircleButtonState();
}

class _ShareToCircleButtonState extends ConsumerState<_ShareToCircleButton> {
  late bool _shared = widget.share?.isShared ?? false;
  late String? _shareId =
      (widget.share?.isShared ?? false) ? widget.share!.shareId : null;
  bool _pending = false;

  @override
  void didUpdateWidget(covariant _ShareToCircleButton old) {
    super.didUpdateWidget(old);
    // Re-seed from fresh server state when the day refetches — but never mid
    // mutation, so the optimistic flip isn't stomped by a stale frame. Compare
    // the FULL share state: the shareId can change under the same visibility.
    final changed = widget.share?.visibility != old.share?.visibility ||
        widget.share?.shareId != old.share?.shareId;
    if (!_pending && changed) {
      _shared = widget.share?.isShared ?? false;
      _shareId = _shared ? widget.share?.shareId : null;
    }
  }

  Future<void> _toggle() async {
    if (_pending) return;
    HapticFeedback.lightImpact();
    final next = _shared ? 'private' : 'circle';
    setState(() {
      _pending = true;
      _shared = next == 'circle'; // optimistic
    });
    try {
      final result = await setMealShareVisibility(
        ref,
        mealId: widget.mealId,
        visibility: next,
      );
      if (!mounted) return;
      // The server response is the truth — not the requested `next` value.
      final isShared = result.visibility != 'private';
      setState(() {
        _pending = false;
        _shared = isShared;
        _shareId = isShared ? result.shareId : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _shared = !_shared; // revert
        _pending = false;
      });
      showTopToast(
        context,
        tr(next == 'circle'
            ? 'groups.shareControl.errorShare'
            : 'groups.shareControl.errorUnshare'),
        variant: TopToastVariant.error,
      );
    }
  }

  Future<void> _shareCard() async {
    final shareId = _shareId;
    if (shareId == null) return;
    HapticFeedback.lightImpact();
    await Share.share(
      '${Env.apiBaseUrl}/api/og/macro-card/$shareId',
      subject: tr('groups.shareControl.shareCardTitle'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final label = _pending
        ? tr('groups.shareControl.sharing')
        : _shared
            ? tr('groups.shareControl.shared')
            : tr('groups.shareControl.share');
    final Color fg = _shared ? NhamColors.accentDark : NhamColors.textMuted;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // "Share card" appears only once the meal is shared (web parity).
        if (_shared && _shareId != null) ...[
          _ShareChip(
            icon: LucideIcons.share2,
            label: tr('groups.shareControl.shareCard'),
            fg: NhamColors.textMuted,
            border: NhamColors.borderSoft,
            fill: Colors.transparent,
            semanticsLabel: tr('groups.shareControl.shareCard'),
            onTap: _shareCard,
          ),
          const SizedBox(width: NhamSpacing.sp2),
        ],
        Semantics(
          button: true,
          toggled: _shared,
          label: label,
          child: GestureDetector(
            onTap: _toggle,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: NhamSpacing.sp2_5,
                vertical: NhamSpacing.sp1_5,
              ),
              decoration: BoxDecoration(
                color: _shared ? NhamColors.accent10 : Colors.transparent,
                borderRadius: BorderRadius.circular(NhamRadii.pill),
                border: Border.all(
                  color: _shared ? NhamColors.accent50 : NhamColors.borderSoft,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_pending)
                    const SizedBox(
                      width: 13,
                      height: 13,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: NhamColors.accentDark,
                      ),
                    )
                  else
                    Icon(
                      _shared ? LucideIcons.check : LucideIcons.users,
                      size: 13,
                      color: fg,
                    ),
                  const SizedBox(width: NhamSpacing.sp1_5),
                  NhamText(
                    label,
                    variant: NhamTextVariant.chipText,
                    style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                        .copyWith(color: fg),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A quiet pill chip used for the secondary "Share card" action.
class _ShareChip extends StatelessWidget {
  const _ShareChip({
    required this.icon,
    required this.label,
    required this.fg,
    required this.border,
    required this.fill,
    required this.semanticsLabel,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color fg;
  final Color border;
  final Color fill;
  final String semanticsLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticsLabel,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp2_5,
            vertical: NhamSpacing.sp1_5,
          ),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
            border: Border.all(color: border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 13, color: fg),
              const SizedBox(width: NhamSpacing.sp1_5),
              NhamText(
                label,
                variant: NhamTextVariant.chipText,
                style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                    .copyWith(color: fg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The "Share with friends" action — opens the copy/split sheet. Text-only, in
/// the muted action-row voice (web parity with the meal card's action buttons).
class _ShareWithFriendsButton extends StatelessWidget {
  const _ShareWithFriendsButton({required this.mealId});

  final String mealId;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        showShareMealSheet(context, mealId);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp2_5,
          vertical: NhamSpacing.sp1_5,
        ),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(NhamRadii.pill),
        ),
        child: NhamText(
          tr('logging.persistedMealCard.shareWithFriends'),
          variant: NhamTextVariant.chipText,
          style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
              .copyWith(color: NhamColors.textMuted),
        ),
      ),
    );
  }
}

/// Card: rounded-2xl (16px), border/60 hairline, shadow.sm, padding 16.
class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
        boxShadow: const [NhamShadows.sm],
      ),
      child: child,
    );
  }
}
