/// Vendored verbatim from web `lib/domain/onboarding/data/countries.ts`
/// (keep in sync).
/// `value` = ISO English short name (stored in DB); `vi` = display hint.
library;

class Country {
  final String value;
  final String vi;

  /// ISO 3166-1 alpha-2, uppercase. Matches the platform locale's
  /// `countryCode`, so the device region can pick a default country.
  final String code;

  const Country(this.value, this.vi, this.code);
}

const List<Country> kCountries = [
  Country('Afghanistan', 'Afghanistan', 'AF'),
  Country('Argentina', 'Argentina', 'AR'),
  Country('Australia', 'Úc', 'AU'),
  Country('Austria', 'Áo', 'AT'),
  Country('Bangladesh', 'Bangladesh', 'BD'),
  Country('Belgium', 'Bỉ', 'BE'),
  Country('Brazil', 'Brazil', 'BR'),
  Country('Cambodia', 'Campuchia', 'KH'),
  Country('Canada', 'Canada', 'CA'),
  Country('Chile', 'Chile', 'CL'),
  Country('China', 'Trung Quốc', 'CN'),
  Country('Colombia', 'Colombia', 'CO'),
  Country('Czech Republic', 'Séc', 'CZ'),
  Country('Denmark', 'Đan Mạch', 'DK'),
  Country('Egypt', 'Ai Cập', 'EG'),
  Country('Finland', 'Phần Lan', 'FI'),
  Country('France', 'Pháp', 'FR'),
  Country('Germany', 'Đức', 'DE'),
  Country('Greece', 'Hy Lạp', 'GR'),
  Country('Hong Kong', 'Hồng Kông', 'HK'),
  Country('Hungary', 'Hungary', 'HU'),
  Country('India', 'Ấn Độ', 'IN'),
  Country('Indonesia', 'Indonesia', 'ID'),
  Country('Ireland', 'Ireland', 'IE'),
  Country('Israel', 'Israel', 'IL'),
  Country('Italy', 'Ý', 'IT'),
  Country('Japan', 'Nhật Bản', 'JP'),
  Country('Laos', 'Lào', 'LA'),
  Country('Malaysia', 'Malaysia', 'MY'),
  Country('Mexico', 'Mexico', 'MX'),
  Country('Myanmar', 'Myanmar', 'MM'),
  Country('Nepal', 'Nepal', 'NP'),
  Country('Netherlands', 'Hà Lan', 'NL'),
  Country('New Zealand', 'New Zealand', 'NZ'),
  Country('Nigeria', 'Nigeria', 'NG'),
  Country('Norway', 'Na Uy', 'NO'),
  Country('Pakistan', 'Pakistan', 'PK'),
  Country('Peru', 'Peru', 'PE'),
  Country('Philippines', 'Philippines', 'PH'),
  Country('Poland', 'Ba Lan', 'PL'),
  Country('Portugal', 'Bồ Đào Nha', 'PT'),
  Country('Romania', 'Romania', 'RO'),
  Country('Russia', 'Nga', 'RU'),
  Country('Saudi Arabia', 'Ả Rập Xê Út', 'SA'),
  Country('Singapore', 'Singapore', 'SG'),
  Country('South Africa', 'Nam Phi', 'ZA'),
  Country('South Korea', 'Hàn Quốc', 'KR'),
  Country('Spain', 'Tây Ban Nha', 'ES'),
  Country('Sri Lanka', 'Sri Lanka', 'LK'),
  Country('Sweden', 'Thụy Điển', 'SE'),
  Country('Switzerland', 'Thụy Sĩ', 'CH'),
  Country('Taiwan', 'Đài Loan', 'TW'),
  Country('Thailand', 'Thái Lan', 'TH'),
  Country('Turkey', 'Thổ Nhĩ Kỳ', 'TR'),
  Country('Ukraine', 'Ukraine', 'UA'),
  Country('United Arab Emirates', 'UAE', 'AE'),
  Country('United Kingdom', 'Anh', 'GB'),
  Country('United States', 'Mỹ', 'US'),
  Country('Vietnam', 'Việt Nam', 'VN'),
];

/// Look up a country by ISO 3166-1 alpha-2 code (case-insensitive).
/// Returns `null` for a region Kallo does not list.
Country? countryForCode(String code) {
  final needle = code.trim().toUpperCase();
  for (final c in kCountries) {
    if (c.code == needle) return c;
  }
  return null;
}

/// Look up a country by its stored English short name (the DB `value`).
Country? countryForValue(String value) {
  for (final c in kCountries) {
    if (c.value == value) return c;
  }
  return null;
}

// ── Naming and search ─────────────────────────────────────────────────────
//
// A Vietnamese speaker typing on an English keyboard writes "viet nam", and
// somebody hunting for Đức types "duc" — a plain `contains` on the raw strings
// matches neither, so a search field looked broken in exactly the language the
// app is built around. Only Vietnamese marks are folded: every English country
// `value` in the table above is already ASCII.

/// Each key is the set of characters that fold to its value.
const Map<String, String> _folds = {
  'àáảãạăằắẳẵặâầấẩẫậ': 'a',
  'èéẻẽẹêềếểễệ': 'e',
  'ìíỉĩị': 'i',
  'òóỏõọôồốổỗộơờớởỡợ': 'o',
  'ùúủũụưừứửữự': 'u',
  'ỳýỷỹỵ': 'y',
  'đ': 'd',
};

final Map<String, String> _foldTable = {
  for (final entry in _folds.entries)
    for (final ch in entry.key.split('')) ch: entry.value,
};

/// Lower-cased and stripped of Vietnamese marks — the form both the needle and
/// the haystack are compared in.
String foldForSearch(String value) {
  final buffer = StringBuffer();
  for (final ch in value.toLowerCase().split('')) {
    buffer.write(_foldTable[ch] ?? ch);
  }
  return buffer.toString();
}

/// The name to SHOW for [country] in [languageCode] — the endonym in a
/// Vietnamese app, the ISO English short name everywhere else. What is stored
/// is always `country.value`; this is display only.
String countryLabel(Country country, String languageCode) =>
    languageCode == 'vi' ? country.vi : country.value;

/// The country's OTHER name — the quiet second column beside [countryLabel],
/// so a user who knows it either way finds it either way.
String countryAlias(Country country, String languageCode) =>
    languageCode == 'vi' ? country.value : country.vi;

/// Whether [country] answers [query] under either of its names.
bool countryMatches(Country country, String query) {
  final needle = foldForSearch(query.trim());
  if (needle.isEmpty) return true;
  return foldForSearch(country.value).contains(needle) ||
      foldForSearch(country.vi).contains(needle);
}
