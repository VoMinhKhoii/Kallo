/**
 * Decodes raw Code 128 character set outputs (such as Excel font-encoded strings like C")"(@¹)
 * back into their corresponding numeric barcode representations.
 */
export function tryDecodeFontEncodedBarcode(text: string): string {
  // If it's already only digits, return as-is
  if (/^\d+$/.test(text)) {
    return text;
  }

  let numericString = '';
  let successfullyDecodedAll = true;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let val = -1;

    if (code >= 32 && code <= 126) {
      val = code - 32;
    } else {
      // Handle common extended ASCII mappings in barcode fonts
      switch (code) {
        case 160: // NBSP
        case 8207:
        case 8206:
          val = 0;
          break;
        case 178: val = 82; break; // ²
        case 179: val = 83; break; // ³
        case 185: val = 85; break; // ¹
        case 186: val = 86; break; // º
        case 188: val = 88; break; // ¼
        case 189: val = 89; break; // ½
        case 190: val = 90; break; // ¾
        default:
          if (code >= 194 && code <= 206) {
            val = code - 99; // Maps 194-206 to 95-107
          } else {
            successfullyDecodedAll = false;
          }
      }
    }

    if (val >= 0 && val <= 106) {
      // In Code 128 Mode C, values 0-99 map to double digits.
      // If we encounter a start or switch character (e.g. 103, 104, 105, 99, 100, 101), we can ignore it.
      if (val <= 99) {
        numericString += val.toString().padStart(2, '0');
      }
    }
  }

  // If we converted it to a valid numeric string and it's longer than 5 digits, use it!
  if (successfullyDecodedAll && /^\d+$/.test(numericString) && numericString.length >= 6) {
    return numericString;
  }

  // Fallback: just strip non-digits as a last resort
  const stripped = text.replace(/\D/g, '');
  if (stripped.length >= 6) {
    return stripped;
  }

  return text;
}
