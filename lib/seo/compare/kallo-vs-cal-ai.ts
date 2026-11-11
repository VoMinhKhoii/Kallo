import type { ComparePage } from './types';

/**
 * "Kallo vs Cal AI". Cal AI's facts were read on its own site and US App Store
 * listing on `checkedOn` (SEO routine `state/alternatives-cal-ai-facts-2026-11-11.json`);
 * Kallo's come from /en/pricing and the docs' accuracy page. Re-check before
 * changing a price, and bump `checkedOn` when you do.
 */
export const KALLO_VS_CAL_AI: ComparePage = {
  them: 'Cal AI',
  alternatives: 'cal-ai',
  metaTitle: 'Kallo vs Cal AI: Type Your Meal or Photograph It',
  description:
    'Kallo and Cal AI side by side: how each logs a meal, what is free, the US price (checked 11 November 2026), and what each says about accuracy.',
  title: 'Kallo vs Cal AI',
  checkedOn: '2026-11-11',
  answer:
    'Cal AI starts from a photo of your plate. Kallo starts from a sentence: you type what you ate, and it shows the calories as a range and asks when the words leave a portion open. Cal AI runs on iOS and Android, and nothing is free after a 3-day trial. Kallo runs on iOS and the web and has a free plan.',
  disclosure:
    'We make Kallo, so this is a vendor’s comparison. Cal AI’s facts come from its own site and US App Store listing, checked on 11 November 2026. The sources are listed at the end.',
  rows: [
    {
      label: 'Logs a meal by',
      kallo:
        'Typing it the way you would say it; also barcode and nutrition label',
      them: 'Photo; also barcode and a typed description',
    },
    {
      label: 'Free',
      kallo:
        'Barcode scanning, manual logging, macros. Everything is free while Kallo is in beta',
      them: 'Nothing after a 3-day trial: scan results need a subscription',
    },
    {
      label: 'Paid (US)',
      kallo: '$29.99 a year on the web, once beta ends',
      them: 'Plans listed from $2.99 to $29.99 on the US App Store, with no billing period shown',
    },
    { label: 'Platforms', kallo: 'iOS, web', them: 'iOS, Android' },
    {
      label: 'Accuracy, in its maker’s words',
      kallo:
        'A single day’s error can be 20–30%; three weeks average out far smaller',
      them: 'About 80% accurate',
    },
  ],
  sections: [
    {
      heading: 'How each one logs a meal',
      body: [
        'Cal AI is built around the camera. You snap a photo and it returns a nutrition breakdown. It also scans barcodes and reads a typed description.',
        'Kallo is built around the sentence, like “leftover spaghetti bolognese and a side salad”. It splits the meal into ingredients and counts calories and macros from USDA and FAO food data. You get a range, with the ingredients it counted. When the words can’t settle a portion, it asks. Kallo reads a nutrition label from a photo, but it can’t log a meal from a photo of the plate.',
      ],
    },
    {
      heading: 'Accuracy',
      body: [
        'In a preliminary NIH test presented at NUTRITION 2026, Cal AI and three other photo apps read pictures of 102 meals whose ingredients had been weighed. All four came in about 250 to 345 kcal low per meal on average, and about 30 g low on fat. The test published no figure per app. Cal AI’s own FAQ says it is about 80% accurate.',
        'No independent test has measured Kallo. Its docs say a single day’s estimate can be off by 20–30%, and that the error averages out over a few weeks.',
      ],
    },
  ],
  pickThem: [
    'You would rather take a photo than type.',
    'You use an Android phone.',
  ],
  pickKallo: [
    'You would rather describe the meal, including how it was cooked.',
    'You want barcode scanning without paying.',
    'You also log on a computer.',
  ],
  dataHeading: 'Why the description matters',
  data: (f) =>
    `We logged ${f.dishes} everyday meals in Kallo ${f.perDish} common ways each, ${f.meals} meals in all. For the typical dish, the heaviest version had ${f.ratio}× the calories of the lightest. Kallo counted cooking oil in ${f.withOil} of them, and in ${f.unnamed} nobody had mentioned oil, butter or frying. A photo shows the plate. The sentence can say how much oil went in.`,
  sources: [
    { label: 'Cal AI', url: 'https://www.calai.app/' },
    {
      label: 'Cal AI on the App Store',
      url: 'https://apps.apple.com/us/app/id6480417616',
    },
    {
      label: 'NIH test, NUTRITION 2026',
      url: 'https://www.newswise.com/articles/photo-based-calorie-tracking-apps-may-underestimate-energy-in-meals',
    },
    { label: 'Kallo pricing', url: 'https://kallo.fit/en/pricing' },
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
