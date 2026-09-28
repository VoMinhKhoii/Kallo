import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/scan/panel/type_barcode_panel.dart';

/// "Type barcode" keeps digits only, at most a GTIN-14, in groups of four so
/// the code reads against the pack at a glance.
void main() {
  String format(String typed) =>
      const BarcodeDigitsFormatter()
          .formatEditUpdate(
            TextEditingValue.empty,
            TextEditingValue(text: typed),
          )
          .text;

  test('groups digits in fours', () {
    expect(format('8938507849131'), '8938 5078 4913 1');
    expect(format('8938'), '8938');
    expect(format(''), '');
  });

  test('drops anything that is not a digit, pasted or typed', () {
    expect(format('8938-5078 49a13.1'), '8938 5078 4913 1');
  });

  test('stops at 14 digits', () {
    expect(format('12345678901234567'), '1234 5678 9012 34');
  });

  test('keeps the caret at the end', () {
    final value = const BarcodeDigitsFormatter().formatEditUpdate(
      TextEditingValue.empty,
      const TextEditingValue(text: '89385078'),
    );
    expect(value.selection, const TextSelection.collapsed(offset: 9));
  });
}
