import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../../../theme/kallo_theme.dart';
import 'panel.dart';

/// The digits of the longest retail code (GTIN-14); EAN-8 is the shortest.
const int kMaxBarcodeDigits = 14;
const int kMinBarcodeDigits = 8;

/// Keeps digits only, at most [kMaxBarcodeDigits], grouped in fours so a long
/// code can be checked against the pack at a glance ("8938 5078 4913 1").
class BarcodeDigitsFormatter extends TextInputFormatter {
  const BarcodeDigitsFormatter();

  static String digitsOf(String text) => text.replaceAll(RegExp(r'\D'), '');

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = digitsOf(newValue.text);
    if (digits.length > kMaxBarcodeDigits) {
      digits = digits.substring(0, kMaxBarcodeDigits);
    }
    final grouped = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && i % 4 == 0) grouped.write(' ');
      grouped.write(digits[i]);
    }
    final text = grouped.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// "Type barcode": a short sheet on the number pad over the live camera, the
/// digits large enough to check against the pack, and one full-width Look up.
class TypeBarcodePanel extends StatefulWidget {
  const TypeBarcodePanel({
    super.key,
    required this.onBack,
    required this.onLookUp,
    required this.searching,
    this.errorText,
  });

  final VoidCallback onBack;
  final ValueChanged<String> onLookUp;
  final bool searching;
  final String? errorText;

  @override
  State<TypeBarcodePanel> createState() => _TypeBarcodePanelState();
}

class _TypeBarcodePanelState extends State<TypeBarcodePanel> {
  final _controller = TextEditingController();

  String get _digits => BarcodeDigitsFormatter.digitsOf(_controller.text);

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_digits.length < kMinBarcodeDigits || widget.searching) return;
    widget.onLookUp(_digits);
  }

  @override
  Widget build(BuildContext context) {
    final digitStyle = kPageTitle().copyWith(
      fontSize: 32,
      letterSpacing: 0.5,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return ScanPanel(
      height: ScanPanelHeight.fit,
      header: KalloSheetHeader(
        title: 'logging.scan.typeBarcode'.tr(),
        onBack: widget.onBack,
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CupertinoTextField(
              controller: _controller,
              autofocus: true,
              keyboardType: TextInputType.number,
              inputFormatters: const [BarcodeDigitsFormatter()],
              textAlign: TextAlign.center,
              decoration: null,
              padding: EdgeInsets.zero,
              style: digitStyle,
              cursorColor: kInk,
              placeholder: '0000 0000 0000 00',
              placeholderStyle: digitStyle.copyWith(color: KalloColors.border),
              onSubmitted: (_) => _submit(),
            ),
            if (widget.errorText != null) ...[
              const SizedBox(height: KalloSpacing.sp3),
              Text(
                widget.errorText!,
                textAlign: TextAlign.center,
                style: dashMeta(color: KalloColors.danger),
              ),
            ],
            const SizedBox(height: KalloSpacing.sp5),
            KalloButton(
              title: 'logging.scan.lookUp'.tr(),
              loading: widget.searching,
              disabled: _digits.length < kMinBarcodeDigits,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
