import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/data/countries.dart';
import '../../../shared/widgets/form/kallo_text_field.dart';
import '../../../shared/widgets/form/option_row.dart';
import '../../../shared/widgets/list/grouped_list_card.dart';
import '../../../shared/widgets/list/list_row.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_answers.dart';
import '../logic/region_defaults.dart';
import '../widgets/origin/country_sheet.dart';
import '../widgets/origin/origin_residence_row.dart';

/// Screen 2 — "Where do you cook?". The step opens ANSWERED: the phone's
/// region is selected and noted "From your phone", with Việt Nam and the
/// language's usual destinations under it. The full A–Z list sits underneath,
/// and typing filters both blocks at once.
class StepOrigin extends StatefulWidget {
  const StepOrigin({
    super.key,
    required this.answers,
    required this.deviceCountry,
    required this.onChanged,
  });

  final OnboardingAnswers answers;

  /// The country the phone's region resolves to — the row that carries the
  /// "From your phone" note, whether or not it is still the pick.
  final String? deviceCountry;

  final VoidCallback onChanged;

  static const double suggestionHeight = 52;

  @override
  State<StepOrigin> createState() => _StepOriginState();
}

class _StepOriginState extends State<StepOrigin> {
  final TextEditingController _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _pick(String value) {
    widget.answers.countryOfOrigin = value;
    widget.onChanged();
  }

  Future<void> _changeResidence() async {
    final picked = await pickCountry(
      context,
      selectedValue: widget.answers.countryOfResidence,
    );
    if (picked == null) return;
    widget.answers.countryOfResidence = picked;
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final language = context.locale.languageCode;
    // Off the language PICKED on screen 1, recomputed every build: a
    // `late final` off the phone's froze out anyone who switched.
    final suggested = suggestedOriginCountries(
      regionCountryValue: widget.deviceCountry,
      languageCode: widget.answers.preferredLocale,
    );
    final matching =
        kCountries.where((c) => countryMatches(c, _query)).toList();
    final matchingValues = {for (final c in matching) c.value};
    final suggestions = suggested.where(matchingValues.contains).toList();
    final rest =
        matching.where((c) => !suggested.contains(c.value)).toList();
    final residence = widget.answers.countryOfResidence;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KalloTextField(
          controller: _search,
          hintText: tr('onboarding.origin.searchHint'),
          onChanged: (v) => setState(() => _query = v),
          prefixIcon: const Icon(
            LucideIcons.search300,
            size: KalloIcons.tertiary,
            color: kInkMuted,
          ),
        ),
        for (final value in suggestions) ...[
          const SizedBox(height: KalloSpacing.sp3),
          OptionRow(
            label: _display(value, language),
            height: StepOrigin.suggestionHeight,
            selected: widget.answers.countryOfOrigin == value,
            note: value == widget.deviceCountry
                ? tr('onboarding.fromDevice')
                : null,
            onTap: () => _pick(value),
          ),
        ],
        if (residence != null) ...[
          const SizedBox(height: KalloSpacing.sp3),
          OriginResidenceRow(
            country: _display(residence, language),
            fromDevice: residence == widget.deviceCountry,
            onChange: _changeResidence,
          ),
        ],
        if (rest.isNotEmpty) ...[
          const SizedBox(height: KalloSpacing.sp3),
          GroupLabel(tr('onboarding.origin.allCountries')),
          const SizedBox(height: KalloSpacing.sp2),
          GroupedListCard(
            separatorInset: 0,
            children: [for (final country in rest) _row(country, language)],
          ),
        ],
      ],
    );
  }

  /// A stored country VALUE as the user should read it. Falls back to the
  /// stored string for a country Kallo no longer lists.
  String _display(String value, String language) {
    final country = countryForValue(value);
    return country == null ? value : countryLabel(country, language);
  }

  Widget _row(Country country, String language) {
    final selected = widget.answers.countryOfOrigin == country.value;
    return ListRow(
      label: countryLabel(country, language),
      onTap: () => _pick(country.value),
      trailing: selected
          ? const Icon(
              LucideIcons.check300,
              size: KalloIcons.tertiary,
              color: kInk,
            )
          : null,
    );
  }
}
