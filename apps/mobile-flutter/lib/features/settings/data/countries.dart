/// Country list for the regional settings selector.
///
/// Vendored verbatim from RN `lib/onboarding/data/countries.ts` (keep in sync).
/// [value] = ISO English short name (stored in DB); [vi] = display hint.
library;

class Country {
  final String value;
  final String vi;
  const Country(this.value, this.vi);
}

const List<Country> kCountries = [
  Country('Afghanistan', 'Afghanistan'),
  Country('Argentina', 'Argentina'),
  Country('Australia', 'Úc'),
  Country('Austria', 'Áo'),
  Country('Bangladesh', 'Bangladesh'),
  Country('Belgium', 'Bỉ'),
  Country('Brazil', 'Brazil'),
  Country('Cambodia', 'Campuchia'),
  Country('Canada', 'Canada'),
  Country('Chile', 'Chile'),
  Country('China', 'Trung Quốc'),
  Country('Colombia', 'Colombia'),
  Country('Czech Republic', 'Séc'),
  Country('Denmark', 'Đan Mạch'),
  Country('Egypt', 'Ai Cập'),
  Country('Finland', 'Phần Lan'),
  Country('France', 'Pháp'),
  Country('Germany', 'Đức'),
  Country('Greece', 'Hy Lạp'),
  Country('Hong Kong', 'Hồng Kông'),
  Country('Hungary', 'Hungary'),
  Country('India', 'Ấn Độ'),
  Country('Indonesia', 'Indonesia'),
  Country('Ireland', 'Ireland'),
  Country('Israel', 'Israel'),
  Country('Italy', 'Ý'),
  Country('Japan', 'Nhật Bản'),
  Country('Laos', 'Lào'),
  Country('Malaysia', 'Malaysia'),
  Country('Mexico', 'Mexico'),
  Country('Myanmar', 'Myanmar'),
  Country('Nepal', 'Nepal'),
  Country('Netherlands', 'Hà Lan'),
  Country('New Zealand', 'New Zealand'),
  Country('Nigeria', 'Nigeria'),
  Country('Norway', 'Na Uy'),
  Country('Pakistan', 'Pakistan'),
  Country('Peru', 'Peru'),
  Country('Philippines', 'Philippines'),
  Country('Poland', 'Ba Lan'),
  Country('Portugal', 'Bồ Đào Nha'),
  Country('Romania', 'Romania'),
  Country('Russia', 'Nga'),
  Country('Saudi Arabia', 'Ả Rập Xê Út'),
  Country('Singapore', 'Singapore'),
  Country('South Africa', 'Nam Phi'),
  Country('South Korea', 'Hàn Quốc'),
  Country('Spain', 'Tây Ban Nha'),
  Country('Sri Lanka', 'Sri Lanka'),
  Country('Sweden', 'Thụy Điển'),
  Country('Switzerland', 'Thụy Sĩ'),
  Country('Taiwan', 'Đài Loan'),
  Country('Thailand', 'Thái Lan'),
  Country('Turkey', 'Thổ Nhĩ Kỳ'),
  Country('Ukraine', 'Ukraine'),
  Country('United Arab Emirates', 'UAE'),
  Country('United Kingdom', 'Anh'),
  Country('United States', 'Mỹ'),
  Country('Vietnam', 'Việt Nam'),
];
