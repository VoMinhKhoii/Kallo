import type { ComparePage } from './types';

/**
 * "Kallo vs MyFitnessPal". MyFitnessPal's facts were read on its own site, help
 * centre and US App Store listing on `checkedOn` (SEO routine
 * `state/alternatives-*-facts-2026-11-11.json`), plus Li et al. 2024. Kallo's
 * come from /en/pricing, llms.txt and the docs' accuracy page.
 */
export const KALLO_VS_MYFITNESSPAL: ComparePage = {
  them: 'MyFitnessPal',
  alternatives: 'myfitnesspal',
  metaTitle: 'Kallo vs MyFitnessPal (2026): Type a Meal or Search for It',
  description:
    'Kallo and MyFitnessPal side by side: how each logs a meal, where the food data comes from, what is free, and the US price (checked 11 November 2026).',
  title: 'Kallo vs MyFitnessPal',
  checkedOn: '2026-11-11',
  answer:
    'With MyFitnessPal you search a database of more than 20 million entries and pick one for each food. With Kallo you type the meal in a sentence and it works out the parts and portions. MyFitnessPal’s barcode scanner needs Premium; Kallo’s is on the free plan, and typing a meal is Kallo’s Premium feature once beta ends. MyFitnessPal runs on iOS, Android and the web, Kallo on iOS and the web.',
  disclosure:
    'We make Kallo, so this is a vendor’s comparison. MyFitnessPal’s facts come from its own site, help centre and US App Store listing, checked on 11 November 2026. The sources are listed at the end.',
  rows: [
    {
      label: 'Logs a meal by',
      kallo:
        'Typing it the way you would say it; also barcode and nutrition label',
      them: 'Database search; barcode, photo and voice on Premium',
    },
    {
      label: 'Free',
      kallo:
        'Barcode scanning, manual logging, macros. Typing a meal is Premium. Everything is free while Kallo is in beta',
      them: 'Calorie, weight and exercise tracking by search, with ads',
    },
    {
      label: 'Paid (US)',
      kallo:
        '$29.99 a year on the web or $34.99 on the App Store, once beta ends',
      them: 'Premium, $19.99 a month or $79.99 a year',
    },
    { label: 'Platforms', kallo: 'iOS, web', them: 'iOS, Android, web' },
    {
      label: 'Food data',
      kallo: 'USDA, FAO and the Vietnam food composition table',
      them: 'More than 20 million entries, including ones members add',
    },
  ],
  sections: [
    {
      heading: 'How each one logs a meal',
      body: [
        'In MyFitnessPal you search for each food and pick an entry from the results. Premium adds barcode scanning, a photo meal scan and voice logging.',
        'Kallo reads the whole meal from one sentence, like “leftover spaghetti bolognese and a side salad”. It splits it into ingredients, counts calories and macros, and shows a range. When the words can’t settle a portion, it asks. Barcode scanning is on the free plan; typing a meal and nutrition labels are Premium. It can’t log a meal from a photo of the plate.',
      ],
    },
    {
      heading: 'Where the numbers come from',
      body: [
        'MyFitnessPal’s database includes foods its members create. It marks entries it has reviewed with a check mark and says even those can have mistakes. In a 2024 study that entered the same three-day meal records into 16 apps, MyFitnessPal’s energy totals came out about 251 kcal above the reference for a Western diet and 385 kcal below it for an Asian one. Most apps in the study missed in the same directions.',
        'Kallo matches each ingredient against USDA and FAO data and the Vietnam National Food Composition Table. No independent test has measured it. Its docs say a single day’s estimate can be off by 20–30%, and that the error averages out over a few weeks.',
      ],
    },
  ],
  pickThem: [
    'You eat a lot of packaged or restaurant food and want the biggest database.',
    'You use an Android phone.',
  ],
  pickKallo: [
    'You would rather type a sentence than search for each food.',
    'You want barcode scanning without paying.',
  ],
  dataHeading: 'Why the description matters',
  data: (f) =>
    `We logged ${f.dishes} everyday meals in Kallo ${f.perDish} common ways each, ${f.meals} meals in all. For the typical dish, the heaviest version had ${f.ratio}× the calories of the lightest. Kallo counted cooking oil in ${f.withOil} of them, and in ${f.unnamed} nobody had mentioned oil, butter or frying. A database entry has one number for the dish. The sentence can say how much oil went in.`,
  sources: [
    {
      label: 'MyFitnessPal Premium',
      url: 'https://www.myfitnesspal.com/premium',
    },
    {
      label: 'MyFitnessPal on the App Store',
      url: 'https://apps.apple.com/us/app/id341232718',
    },
    {
      label: 'MyFitnessPal barcode help',
      url: 'https://support.myfitnesspal.com/hc/en-us/articles/360032624771-How-to-use-the-Barcode-Scanner',
    },
    {
      label: 'MyFitnessPal check marks',
      url: 'https://support.myfitnesspal.com/hc/en-us/articles/360032273292-Check-Marked-items',
    },
    {
      label: 'MyFitnessPal on ads',
      url: 'https://support.myfitnesspal.com/hc/en-us/articles/360032273152-The-ad-free-experience-with-MyfitnessPal-Premium',
    },
    {
      label: 'Li et al., Nutrients 2024',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11314244/',
    },
    { label: 'Kallo pricing', url: 'https://kallo.fit/en/pricing' },
    {
      label: 'Kallo on the App Store',
      url: 'https://apps.apple.com/us/app/id6775761392',
    },
    {
      label: 'Kallo accuracy and limits',
      url: 'https://kallo.fit/en/docs/estimates/accuracy-and-limits',
    },
  ],
  method: [
    'Prices are US prices from each app’s own pages, read on 11 November 2026. Prices change and differ by country, so check before you pay.',
  ],
  tryLine: 'Try typing your next meal.',
};
