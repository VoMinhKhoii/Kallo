import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/data/countries.dart';
import '../../../../shared/widgets/form/kallo_text_field.dart';
import '../../../../shared/widgets/list/list_row.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// Opens the full A–Z country list as a modal sheet and returns the pick
/// (`null` when dismissed).
///
/// Screen 2 asks the ORIGIN question inline, on the page, because that is the
/// question the step exists for. Residence is a correction to a guess, so it
/// gets the sheet instead: the same list, but reached from one word rather than
/// occupying a second half of the screen.
Future<String?> pickCountry(
  BuildContext context, {
  required String? selectedValue,
}) {
  HapticFeedback.selectionClick();
  return showNhamSheet<String>(
    context,
    isScrollControlled: true,
    barrierColor: KalloColors.text40,
    builder: (_) => _CountrySheet(selectedValue: selectedValue),
  );
}

class _CountrySheet extends StatefulWidget {
  const _CountrySheet({required this.selectedValue});

  final String? selectedValue;

  @override
  State<_CountrySheet> createState() => _CountrySheetState();
}

class _CountrySheetState extends State<_CountrySheet> {
  final TextEditingController _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final matches =
        kCountries.where((c) => countryMatches(c, _query)).toList();

    // The keyboard inset is `KalloSheetSurface`'s job — it lifts the surface so
    // the pinned search and the list clear the pad.
    return FractionallySizedBox(
      heightFactor: 0.85,
      child: KalloSheetSurface(
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            KalloSheetHeader(title: tr('common.country')),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                KalloSpacing.sp3,
                KalloSpacing.sp4,
                KalloSpacing.sp2,
              ),
              child: KalloTextField(
                controller: _search,
                hintText: tr('onboarding.origin.searchHint'),
                onChanged: (v) => setState(() => _query = v),
                prefixIcon: const Icon(
                  LucideIcons.search300,
                  size: KalloIcons.tertiary,
                  color: kInkMuted,
                ),
              ),
            ),
            Expanded(
              child: matches.isEmpty
                  ? Center(
                      child: Text(
                        tr('onboarding.origin.noCountries'),
                        style: dashBody(color: kInkMuted),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(
                        KalloSpacing.sp4,
                        0,
                        KalloSpacing.sp4,
                        KalloSpacing.sp6,
                      ),
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      itemCount: matches.length,
                      itemBuilder: (context, i) => _row(context, matches[i]),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, Country country) {
    final selected = widget.selectedValue == country.value;
    final language = context.locale.languageCode;
    return ListRow(
      label: countryLabel(country, language),
      value: countryAlias(country, language),
      onTap: () => Navigator.of(context).pop(country.value),
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
