import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../features/logging/widgets/count_up.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../controls/tab_strip.dart';
import '../data/profile_providers.dart';
import '../logic/tdee.dart';
import '../panels/body_metrics.dart';
import '../panels/cooking.dart';
import '../panels/regional.dart';
import 'profile_form_controller.dart';
import 'profile_form_values.dart';

enum _SectionId { bodyMetrics, regional, cooking }

const _fieldSection = <ProfileField, _SectionId>{
  ProfileField.weightKg: _SectionId.bodyMetrics,
  ProfileField.heightCm: _SectionId.bodyMetrics,
  ProfileField.age: _SectionId.bodyMetrics,
};

/// RN port of web `components/settings/profile/index.tsx`. The tabbed profile
/// editor: header + subtitle, [TabStrip], the active panel inside a cream card,
/// and a floating Save/Cancel bar that fades in when the form is dirty.
class ProfileForm extends ConsumerStatefulWidget {
  const ProfileForm({super.key, required this.profile});

  final ProfileRow profile;

  @override
  ConsumerState<ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<ProfileForm> {
  late final ProfileFormController _controller =
      ProfileFormController(ProfileFormValues.fromRow(widget.profile));
  _SectionId _activeTab = _SectionId.bodyMetrics;
  String? _errorText;

  // Felt-save state: after a successful save the bar morphs into a
  // "Changes saved · N kcal/day" confirmation, the target counting old→new,
  // holding ~1.6s before dissolving. Null = no confirmation showing.
  int? _savedCalorieTarget;
  int _previousCalorieTarget = 0;
  Timer? _savedTimer;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onFormChanged);
    // The saved calorie target lives in the raw profile row (no typed getter);
    // it seeds the count-up's "from" so the morph animates old→new.
    final rawTarget = widget.profile.raw['calorieTarget'];
    _previousCalorieTarget = rawTarget is num
        ? rawTarget.round()
        : int.tryParse(rawTarget?.toString() ?? '') ?? 0;
  }

  @override
  void dispose() {
    _savedTimer?.cancel();
    _controller.removeListener(_onFormChanged);
    _controller.dispose();
    super.dispose();
  }

  void _onFormChanged() => setState(() {});

  void _handleCancel() {
    _controller.reset();
    setState(() => _errorText = null);
  }

  Future<void> _handleSave() async {
    final v = _controller.values;
    final errors = validateBodyMetrics(v);
    if (errors.isNotEmpty) {
      _controller.setErrors(errors);
      final first = errors.keys.first;
      final section = _fieldSection[first];
      setState(() {
        if (section != null) _activeTab = section;
        _errorText = tr('settings.profilePanel.invalidError');
      });
      return;
    }
    _controller.setErrors(const {});

    // Compute targets exactly as RN `handleSave`.
    final bmr = calcBMR(
      biologicalSex: v.biologicalSex,
      weightKg: v.weightKg!,
      heightCm: v.heightCm!,
      age: v.age!,
    );
    final tdee = calcTDEE(bmr, v.activityLevel);
    final targets =
        calcDailyTargets(tdee, v.goal, v.aggression, v.carbSplit);
    final clampedCalories = targets.calories < 500 ? 500.0 : targets.calories;
    final macros = calcMacroGrams(clampedCalories, v.carbSplit);

    final payload = ProfileSavePayload(
      weightKg: v.weightKg!,
      heightCm: v.heightCm!,
      age: v.age!,
      biologicalSex: v.biologicalSex,
      activityLevel: v.activityLevel,
      tdeeKcal: tdee,
      goal: v.goal,
      aggression: v.aggression,
      carbSplit: v.carbSplit,
      calorieTarget: clampedCalories.round(),
      proteinTargetG: macros.proteinG.round(),
      carbsTargetG: macros.carbsG.round(),
      fatTargetG: macros.fatG.round(),
      countryOfOrigin: v.countryOfOrigin,
      countryOfResidence: v.countryOfResidence,
      preferredLocale: context.locale.languageCode,
      oilUsage: v.oilUsage,
      defaultRicePortion: v.defaultRicePortion,
      sugarBraised: v.sugarBraised,
      defaultProteinPortion: v.defaultProteinPortion,
      brothConsumption: v.brothConsumption,
    );

    setState(() => _errorText = null);
    final ok = await ref.read(saveProfileProvider.notifier).save(payload);
    if (!mounted) return;
    if (ok) {
      HapticFeedback.mediumImpact(); // success cue on save
      _controller.markSaved();
      // Felt save: morph the bar into "Changes saved · N kcal/day", count the
      // target old→new, hold ~1.6s, then dissolve.
      final newTarget = clampedCalories.round();
      _savedTimer?.cancel();
      setState(() => _savedCalorieTarget = newTarget);
      _savedTimer = Timer(const Duration(milliseconds: 1600), () {
        if (!mounted) return;
        setState(() {
          _previousCalorieTarget = newTarget;
          _savedCalorieTarget = null;
        });
      });
    } else {
      setState(() => _errorText = tr('settings.profilePanel.saveError'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final saving = ref.watch(saveProfileProvider).isLoading;
    final tabs = [
      (id: _SectionId.bodyMetrics, title: tr('settings.bodyMetrics'),
          subtitle: tr('settings.profilePanel.bodyMetricsSubtitle')),
      (id: _SectionId.regional, title: tr('settings.regional'),
          subtitle: tr('settings.profilePanel.regionalSubtitle')),
      (id: _SectionId.cooking, title: tr('settings.cooking'),
          subtitle: tr('settings.profilePanel.cookingSubtitle')),
    ];
    final activeSubtitle =
        tabs.firstWhere((t) => t.id == _activeTab).subtitle;

    return ProfileFormScope(
      controller: _controller,
      child: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp4,
              NhamSpacing.sp2,
              NhamSpacing.sp4,
              NhamSpacing.sp16,
            ),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              Text(
                tr('settings.profilePage.title'),
                style: NhamTextStyles.serifRegular(fontSize: NhamFontSize.h3)
                    .copyWith(letterSpacing: NhamTracking.tight, color: NhamColors.text),
              ),
              const SizedBox(height: NhamSpacing.sp1),
              Padding(
                padding: const EdgeInsets.only(bottom: NhamSpacing.sp4),
                child: Text(
                  tr('settings.profilePage.description'),
                  style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.detail)
                      .copyWith(height: 20 / 13, color: NhamColors.textWarm),
                ),
              ),
              TabStrip(
                tabs: [
                  for (final t in tabs)
                    TabStripItem(id: t.id.name, label: t.title),
                ],
                active: _activeTab.name,
                onChange: (id) => setState(() =>
                    _activeTab = _SectionId.values.byName(id)),
              ),
              const SizedBox(height: NhamSpacing.sp2),
              Container(
                padding: const EdgeInsets.all(NhamSpacing.sp3),
                decoration: BoxDecoration(
                  color: NhamColors.cream,
                  borderRadius: BorderRadius.circular(NhamRadii.containerLg),
                  border: Border.all(color: NhamColors.inputBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: NhamSpacing.sp5),
                      child: Text(
                        activeSubtitle,
                        style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.detail)
                            .copyWith(color: NhamColors.textWarm),
                      ),
                    ),
                    switch (_activeTab) {
                      _SectionId.bodyMetrics => const BodyMetrics(),
                      _SectionId.regional => const Regional(),
                      _SectionId.cooking => const Cooking(),
                    },
                  ],
                ),
              ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _SaveBar(
              visible: _controller.isDirty || _savedCalorieTarget != null,
              errorText: _errorText,
              saving: saving,
              savedTarget: _savedCalorieTarget,
              previousTarget: _previousCalorieTarget,
              onCancel: _handleCancel,
              onSave: _handleSave,
            ),
          ),
        ],
      ),
    );
  }
}

/// Floating save bar — AnimatePresence: fades + slides 20px (down→up) over
/// 200ms easeOut on enter, and reverses (fade + slide down) on exit. Content
/// scrolls behind it and dissolves into a soft surface-cream gradient that
/// rises 32px above the rounded card.
class _SaveBar extends StatefulWidget {
  const _SaveBar({
    required this.visible,
    required this.errorText,
    required this.saving,
    required this.savedTarget,
    required this.previousTarget,
    required this.onCancel,
    required this.onSave,
  });

  final bool visible;
  final String? errorText;
  final bool saving;

  /// When non-null, the bar shows the post-save confirmation morph instead of
  /// the Cancel/Save buttons.
  final int? savedTarget;
  final int previousTarget;
  final VoidCallback onCancel;
  final VoidCallback onSave;

  @override
  State<_SaveBar> createState() => _SaveBarState();
}

class _SaveBarState extends State<_SaveBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
    value: widget.visible ? 1 : 0,
  );

  @override
  void didUpdateWidget(_SaveBar old) {
    super.didUpdateWidget(old);
    if (widget.visible != old.visible) {
      widget.visible ? _c.forward() : _c.reverse();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    final curved = CurvedAnimation(parent: _c, curve: Curves.easeOut);
    return IgnorePointer(
      ignoring: !widget.visible,
      child: FadeTransition(
        opacity: curved,
        child: AnimatedBuilder(
          animation: curved,
          builder: (context, child) => Transform.translate(
            offset: Offset(0, 20 * (1 - curved.value)), // y 20 → 0
            child: child,
          ),
          child: Padding(
            // pb-3 (12) floats the card above the bottom edge; sm:px parity →
            // px-5 (20) on mobile.
            padding: EdgeInsets.fromLTRB(
              NhamSpacing.sp5,
              0,
              NhamSpacing.sp5,
              bottomInset + NhamSpacing.sp3,
            ),
            child: Stack(
              children: [
                // Soft surface-cream fade rising 32px above the card.
                const Positioned(
                  left: 0,
                  right: 0,
                  top: -NhamSpacing.sp8,
                  bottom: 0,
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            NhamColors.surface,
                            NhamColors.surface,
                            Color(0x00FEFBF6), // surface @ 0
                          ],
                          stops: [0, 0.55, 1], // from-55%
                        ),
                      ),
                    ),
                  ),
                ),
                _BackdropCard(
                  errorText: widget.errorText,
                  saving: widget.saving,
                  savedTarget: widget.savedTarget,
                  previousTarget: widget.previousTarget,
                  onCancel: widget.onCancel,
                  onSave: widget.onSave,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The floating rounded-2xl card: full border, cream/95 fill, shadow-lg,
/// backdrop blur. Right-aligned Cancel + Save.
class _BackdropCard extends StatelessWidget {
  const _BackdropCard({
    required this.errorText,
    required this.saving,
    required this.savedTarget,
    required this.previousTarget,
    required this.onCancel,
    required this.onSave,
  });

  final String? errorText;
  final bool saving;
  final int? savedTarget;
  final int previousTarget;
  final VoidCallback onCancel;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(NhamRadii.containerLg), // rounded-2xl
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8), // backdrop-blur-sm
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp5, // px-5
            vertical: 14, // py-3.5
          ),
          decoration: BoxDecoration(
            color: NhamColors.cream95,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
            border: Border.all(color: NhamColors.inputBorder),
            boxShadow: const [
              // shadow-lg
              BoxShadow(
                color: Color(0x1A000000),
                blurRadius: 15,
                offset: Offset(0, 10),
              ),
              BoxShadow(
                color: Color(0x14000000),
                blurRadius: 6,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: savedTarget != null
              ? _SavedConfirmation(
                  target: savedTarget!,
                  previousTarget: previousTarget,
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (errorText != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: NhamSpacing.sp2),
                        child: Text(
                          errorText!,
                          textAlign: TextAlign.right,
                          style: NhamTextStyles.sansRegular(
                                  fontSize: NhamFontSize.xs)
                              .copyWith(color: NhamColors.danger),
                        ),
                      ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        _GhostButton(
                          label: tr('common.cancel'),
                          onTap: saving ? null : onCancel,
                        ),
                        const SizedBox(width: NhamSpacing.sp3),
                        _SaveButton(
                          saving: saving,
                          onTap: saving ? null : onSave,
                        ),
                      ],
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _GhostButton extends StatefulWidget {
  const _GhostButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback? onTap;

  @override
  State<_GhostButton> createState() => _GhostButtonState();
}

class _GhostButtonState extends State<_GhostButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // Cancel hover: bg → #F5F4F0 AND text darkens #7B6F62 → #2C2416.
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150), // transition-colors
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp5, // px-5
          vertical: 10, // py-2.5
        ),
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.track : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
        ),
        child: AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 150),
          style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm).copyWith(
            color: _pressed ? NhamColors.text : NhamColors.textWarm,
          ),
          child: Text(widget.label),
        ),
      ),
    );
  }
}

/// The post-save confirmation that the save bar morphs into: a sage check, the
/// "Changes saved" line, then the new calorie target counting up from the
/// previous value (CountUpText) with a "kcal/day" unit. Holds ~1.6s upstream.
class _SavedConfirmation extends StatelessWidget {
  const _SavedConfirmation({
    required this.target,
    required this.previousTarget,
  });

  final int target;
  final int previousTarget;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final fmt = NumberFormat.decimalPattern(locale);
    final reduceMotion =
        MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        const Icon(LucideIcons.check, size: 16, color: NhamColors.success),
        const SizedBox(width: 8),
        Text(
          tr('settings.saved'),
          style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
              .copyWith(color: NhamColors.text),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            '·',
            style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
                .copyWith(color: NhamColors.border),
          ),
        ),
        CountUpText(
          value: target.toDouble(),
          from: previousTarget.toDouble(),
          enabled: !reduceMotion,
          format: (v) => '${fmt.format(v.round())} '
              '${tr('onboarding.bodyMetrics.perDay')}',
          style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm).copyWith(
            color: NhamColors.text,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

class _SaveButton extends StatefulWidget {
  const _SaveButton({required this.saving, required this.onTap});
  final bool saving;
  final VoidCallback? onTap;

  @override
  State<_SaveButton> createState() => _SaveButtonState();
}

class _SaveButtonState extends State<_SaveButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // bg #2C2416, hover:bg-#1C1917, text #FDFCF8, shadow-sm, transition-all.
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: Opacity(
        opacity: widget.saving ? 0.5 : 1,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150), // transition-all
          constraints: const BoxConstraints(minWidth: 88),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp5, // px-5
            vertical: 10, // py-2.5
          ),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.btnDarkHover : NhamColors.text,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
            boxShadow: const [NhamShadows.sm],
          ),
          child: widget.saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(NhamColors.cream),
                  ),
                )
              : Text(
                  tr('settings.save'),
                  style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
                      .copyWith(color: NhamColors.cream),
                ),
        ),
      ),
    );
  }
}
