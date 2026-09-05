import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shared/widgets/mascot/bun_mascot.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../auth/widgets/auth_page.dart';

/// The last signed-out screen (`/save-plan`): the auth surface wearing the
/// onboarding chrome.
///
/// It is the wizard's seventh beat, not a login wall — the plan already exists
/// in the local draft, and signing in is what carries it to the server (and to
/// the user's other devices). Hence the bun's line and the title: the ask is
/// framed as saving, not as gatekeeping.
///
/// There is NO "Later" and no skip. The app is authenticated-only, so the
/// draft has nowhere to go without a session; offering a way past this screen
/// would only strand the answers on disk. The back chevron returns to the
/// wizard, which resumes on the last screen the draft reached.
///
/// The three options come from [AuthPage] itself (`compact: true` drops its
/// brand block) rather than being restated here — one auth stack, one set of
/// error and busy states, one legal footnote.
class SavePlanScreen extends StatelessWidget {
  const SavePlanScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KalloColors.surface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              // The chrome keeps the 24pt onboarding gutter; the auth stack
              // below brings its own (`kAuthInset`), so it must not be nested
              // inside this one.
              padding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp6,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // The step header minus the progress bar and the Skip: the
                  // back chevron returns to the wizard.
                  WordmarkBar(leading: _back(context)),
                  const SizedBox(height: KalloSpacing.sp3),
                  BunMascot(speech: tr('onboarding.guide.step7')),
                  const SizedBox(height: KalloSpacing.sp3),
                  Text(
                    tr('onboarding.savePlanTitle'),
                    style: kPageTitle(),
                  ),
                ],
              ),
            ),
            const Expanded(child: AuthPage(compact: true)),
          ],
        ),
      ),
    );
  }

  Widget _back(BuildContext context) => Semantics(
    button: true,
    label: Localizations.of<MaterialLocalizations>(
      context,
      MaterialLocalizations,
    )?.backButtonTooltip,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.go('/onboarding'),
      child: const SizedBox(
        width: KalloIcons.hit,
        height: KalloIcons.hit,
        child: Icon(
          LucideIcons.chevronLeft300,
          size: KalloIcons.primary,
          color: kInk,
        ),
      ),
    ),
  );
}
