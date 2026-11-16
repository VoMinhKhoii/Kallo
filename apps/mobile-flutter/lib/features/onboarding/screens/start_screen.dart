import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/widgets/panes/narrative_panes.dart';
import '../widgets/narrative/start_task.dart';

import '../../../shared/widgets/brand/kallo_wordmark.dart';
import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/typography/meta_action.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../widgets/backdrop/start_aurora.dart';
import '../widgets/start/start_device_preview.dart';
import '../widgets/start/start_hero.dart';
import '../widgets/start/start_preview_box.dart';

/// The signed-out entry (`/start`).
///
/// The first thing a new install sees: the wordmark on the aurora sweep, a
/// device preview of the Log screen ringed by ten clay dishes and dissolving
/// into the canvas, the promise in one line, and the two ways in — "Get
/// started" runs the wizard BEFORE sign-in (the answers live in a local draft
/// until `/save-plan`), and the quiet link is for the account that already
/// exists.
///
/// Two anchors, not one column: the wordmark row and the preview are measured
/// from the top of the SAFE AREA (8 and 68), while the title, the CTA and the
/// link hug the BOTTOM of it. The preview's fade then runs UNDER the title —
/// the promise reads as sitting in the dissolve, not as a caption butted
/// against a card's edge. Only the preview flexes: it is the one block that
/// can lose height without the screen losing meaning, so on a short phone it
/// scales down instead of pushing the CTA off the bottom.
class StartScreen extends StatelessWidget {
  const StartScreen({super.key});

  /// Design metrics, all measured from the top of the safe area.
  ///
  /// The lift (2026-09-06). The wordmark is this flow's top-centre header, so
  /// it now sits where every later screen's [WordmarkBar] sits — a 44pt row
  /// starting 8pt under the safe area, the mark centred in it — rather than
  /// floating 66pt down on its own. The block then starts 16pt under that row,
  /// at 68 instead of 132. Everything those two moves gave back goes into the
  /// block's fill scale: the art got bigger, the promise-to-CTA gap did not
  /// move.
  static const double _headerTop = StartHero.headerTop;
  static const double _headerGap = StartHero.headerGap;
  static const double _wordmarkHeight = StartHero.wordmarkHeight;

  /// The device card, so a layout test can measure what it actually got.
  static const Key previewKey = StartDevicePreview.previewKey;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KalloColors.surface,
      body: Stack(
        children: [
          const Positioned.fill(child: StartAurora()),
          NarrativePanes(
            far: const StartHero(),
            near: const SafeArea(
              minimum: EdgeInsets.only(top: 12),
              child: StartTask(),
            ),
            single: SafeArea(
              minimum: EdgeInsets.only(
                top: MediaQuery.viewPaddingOf(context).top == 0 ? 12 : 0,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 468),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: KalloSpacing.sp6,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: _headerTop),
                        const SizedBox(
                          height: WordmarkBar.rowHeight,
                          child: Center(
                            child: KalloWordmark(height: _wordmarkHeight),
                          ),
                        ),
                        const SizedBox(height: _headerGap),
                        // Everything the buttons do not claim: the preview and the
                        // promise sitting in its dissolve.
                        //
                        // The title starts ON the dissolve's bottom edge — its top
                        // sits [StartDevicePreview.titleOffset] BELOW the card's bottom,
                        // where the band has been solid canvas for 29pt — so the
                        // promise reads as rising out of the fade rather than as a
                        // caption under a picture. Below it comes the design's 24pt
                        // of air, and every spare point on the screen goes into the
                        // block above, never into that gap.
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Flexible, not Expanded: the preview takes its natural
                              // height until the leftover is genuinely too short, and
                              // only then gives some up.
                              const Flexible(child: StartPreviewBox()),
                              Text(
                                context.tr('onboarding.start.title'),
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: kPageTitle(),
                              ),
                              const SizedBox(height: KalloSpacing.sp6),
                            ],
                          ),
                        ),
                        KalloButton(
                          title: context.tr('onboarding.start.cta'),
                          variant: KalloButtonVariant.cta,
                          onPressed: () => context.push('/onboarding'),
                        ),
                        const SizedBox(height: KalloSpacing.sp3),
                        // The quiet way back for an account that already exists.
                        //
                        // PUSH, not go, for both of these: `/start` is where both
                        // roads begin, and a `go` would replace it — leaving the
                        // wizard's screen-1 chevron and the sign-in face with
                        // nothing under them to return to. Every pre-auth route is
                        // in `_preAuthRoutes`, so the redirect leaves a signed-out
                        // user on whichever one they are standing on, and the stack
                        // is cleared for them the moment they sign in (the redirect
                        // to `/welcome` re-parses the location and drops the pushed
                        // matches).
                        MetaAction(
                          label: context.tr('onboarding.start.haveAccount'),
                          onTap: () => context.push('/sign-in'),
                        ),
                        const SizedBox(height: KalloSpacing.sp3),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
