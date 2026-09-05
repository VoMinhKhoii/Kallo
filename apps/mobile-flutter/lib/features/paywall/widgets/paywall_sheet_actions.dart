import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/logic/legal_links.dart';
import '../../../shared/widgets/typography/meta_action.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../data/paywall_controller.dart';
import '../logic/paywall_result.dart';

/// "Restore purchases · Terms · Privacy" — the three obligations, on one quiet
/// meta line under the CTA.
///
/// The legal pages open through `shared/logic/legal_links.dart` (the same two
/// the Settings About group links to), so they land in the app's own language
/// instead of re-detecting the locale from the bare redirect path.
class PaywallSheetActions extends ConsumerWidget {
  const PaywallSheetActions({required this.state, super.key});

  final PaywallState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final languageCode = context.locale.languageCode;
    final busy =
        state.phase == PaywallPhase.purchasing ||
        state.phase == PaywallPhase.verifying;
    // `Flexible` would divide the line into three EQUAL shares, so the longest
    // label ("Restore purchases") lost its tail to an ellipsis while the two
    // shorter ones sat on spare room they had no use for. The three sit at
    // their intrinsic widths instead, and the line as a whole scales down only
    // when it genuinely cannot fit (a narrow phone, or large text).
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          MetaAction(
            label: tr('paywall.restore'),
            onTap: busy ? null : () => _restore(context, ref),
            // Disabled while the store round trip is in flight — the label
            // recedes rather than disappearing, so the line does not reflow.
            color: busy ? KalloColors.textMuted50 : null,
          ),
          const _Dot(),
          MetaAction(
            label: tr('paywall.terms'),
            onTap: () => openLegalPage(context, termsUrlFor(languageCode)),
          ),
          const _Dot(),
          MetaAction(
            label: tr('paywall.privacy'),
            onTap: () => openLegalPage(context, privacyUrlFor(languageCode)),
          ),
        ],
      ),
    );
  }

  Future<void> _restore(BuildContext context, WidgetRef ref) async {
    HapticFeedback.lightImpact();
    final result =
        await ref.read(paywallControllerProvider.notifier).restore();
    if (context.mounted) handlePaywallResult(context, result);
  }
}

class _Dot extends StatelessWidget {
  const _Dot();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp1_5),
        child: Text('·', style: dashMeta()),
      );
}
