import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../logic/step_one_defaults.dart';
import '../widgets/country_select.dart';
import '../widgets/language_toggle.dart';

/// RN port of `components/onboarding/screens/screen-origin.tsx` (step 1).
///
/// No validation; reports on mount so Next is enabled immediately. The toggle
/// sets the persisted `preferredLocale` AND live-switches the app language via
/// `context.setLocale` (matching web's `switchLocale`). lucide
/// `Languages`/`Globe`/`MapPin` →
/// [LucideIcons.languages]/[LucideIcons.globe]/[LucideIcons.mapPin].
class ScreenOrigin extends StatefulWidget {
  const ScreenOrigin({
    super.key,
    required this.defaultValues,
    required this.onChange,
  });

  final StepOneData defaultValues;
  final ValueChanged<Map<String, dynamic>> onChange;

  @override
  State<ScreenOrigin> createState() => _ScreenOriginState();
}

class _ScreenOriginState extends State<ScreenOrigin> {
  late String? _origin = widget.defaultValues.countryOfOrigin;
  late String? _residence = widget.defaultValues.countryOfResidence;
  late String _locale = widget.defaultValues.preferredLocale;

  @override
  void initState() {
    super.initState();
    // Report on mount (matches the RN `hasReported` ref effect).
    WidgetsBinding.instance.addPostFrameCallback((_) => _report());
  }

  void _report() {
    widget.onChange({
      'countryOfOrigin': _origin,
      'countryOfResidence': _residence,
      'preferredLocale': _locale,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // head — gap[1]
        Text(
          tr('onboarding.origin.title'),
          style: NhamTextStyles.serifMedium(fontSize: 24)
              .copyWith(letterSpacing: -0.3, color: NhamColors.text),
        ),
        const SizedBox(height: NhamSpacing.sp1),
        Text(
          tr('onboarding.origin.subtitle'),
          style: NhamTextStyles.sansRegular(fontSize: 15, height: 24 / 15)
              .copyWith(color: NhamColors.textHelp),
        ),
        const SizedBox(height: NhamSpacing.sp6),

        // Language card
        _Card(
          children: [
            _LabelRow(
              icon: LucideIcons.languages,
              label: tr('onboarding.origin.preferredLanguage'),
            ),
            const SizedBox(height: NhamSpacing.sp4),
            LanguageToggle(
              value: _locale,
              onChange: (v) {
                if (v == _locale) return;
                setState(() => _locale = v);
                context.setLocale(Locale(v)); // live-switch the app language
                _report();
              },
            ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp6),

        // Origin + residence card
        _Card(
          children: [
            _Field(
              icon: LucideIcons.globe,
              label: tr('onboarding.origin.countryOfOrigin'),
              hint: tr('onboarding.origin.countryOfOriginHint'),
              child: CountrySelect(
                value: _origin,
                onChange: (v) {
                  setState(() => _origin = v);
                  _report();
                },
              ),
            ),
            const SizedBox(height: NhamSpacing.sp4),
            _Field(
              icon: LucideIcons.mapPin,
              label: tr('onboarding.origin.countryOfResidence'),
              hint: tr('onboarding.origin.countryOfResidenceHint'),
              child: CountrySelect(
                value: _residence,
                onChange: (v) {
                  setState(() => _residence = v);
                  _report();
                },
              ),
            ),
            const SizedBox(height: NhamSpacing.sp4),
            Text(
              tr('onboarding.origin.fallbackNote'),
              style: NhamTextStyles.sansRegular(fontSize: 13, height: 20 / 13)
                  .copyWith(color: NhamColors.textHelp),
            ),
          ],
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp5),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: NhamColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }
}

class _LabelRow extends StatelessWidget {
  const _LabelRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: NhamColors.accent),
        const SizedBox(width: NhamSpacing.sp2),
        Text(
          label,
          style: NhamTextStyles.sansBold(fontSize: 13)
              .copyWith(color: NhamColors.text),
        ),
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.icon,
    required this.label,
    required this.hint,
    required this.child,
  });

  final IconData icon;
  final String label;
  final String hint;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _LabelRow(icon: icon, label: label),
        const SizedBox(height: NhamSpacing.sp2),
        Text(
          hint,
          style: NhamTextStyles.sansRegular(fontSize: 12, height: 18 / 12)
              .copyWith(color: NhamColors.textHelp),
        ),
        const SizedBox(height: NhamSpacing.sp3), // mb-3 before the field
        child,
      ],
    );
  }
}
