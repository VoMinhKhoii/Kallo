import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../../../data/env.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../../circle/data/circle_providers.dart';
import '../data/logging_models.dart';
import 'persisted_meal_share_chip.dart';

/// The per-meal "Share to circle" toggle plus, once shared, the "Share card"
/// action (the shareable Macro Card link). Optimistically flips its own state,
/// calls `POST /api/v1/groups/shares`, and reverts + toasts on failure.
/// Re-seeds from the server payload when the day refetches. Mirrors the web
/// `ShareToCircleButton` + `ShareCardButton` in `persisted-meal-card.tsx`.
class PersistedMealShareToCircleButton extends ConsumerStatefulWidget {
  const PersistedMealShareToCircleButton({
    super.key,
    required this.mealId,
    required this.share,
  });

  final String mealId;
  final MealShare? share;

  @override
  ConsumerState<PersistedMealShareToCircleButton> createState() =>
      _PersistedMealShareToCircleButtonState();
}

class _PersistedMealShareToCircleButtonState
    extends ConsumerState<PersistedMealShareToCircleButton> {
  late bool _shared = widget.share?.isShared ?? false;
  late String? _shareId =
      (widget.share?.isShared ?? false) ? widget.share!.shareId : null;
  bool _pending = false;

  @override
  void didUpdateWidget(covariant PersistedMealShareToCircleButton old) {
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
      '${Env.webBaseUrl}/api/og/macro-card/$shareId',
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
          PersistedMealShareChip(
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
