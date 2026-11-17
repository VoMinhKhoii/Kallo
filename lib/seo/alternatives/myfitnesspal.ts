import type { AlternativePage, Source } from './types';

/**
 * "MyFitnessPal alternatives". Same rules as `cal-ai.ts`: every price and
 * feature was read on the vendor's own site or its US App Store listing on
 * `checkedOn`, and the page says nothing a source does not. Facts and URLs:
 * the SEO routine's `state/alternatives-mfp-facts-2026-11-11.json` (FatSecret,
 * MyNetDiary, why people leave) and `alternatives-cal-ai-facts-2026-11-11.json`
 * (the apps both pages list).
 */

const LI_2024: Source = {
  label: 'Li et al., Nutrients 2024',
  url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11314244/',
};

export const MYFITNESSPAL_ALTERNATIVES: AlternativePage = {
  metaTitle: 'MyFitnessPal Alternatives (2026): 7 Apps, Free and Paid',
  description:
    'Seven MyFitnessPal alternatives, what each one gives you free (barcode scanner included or not), and the US price, checked on the vendors’ own pages.',
  title: 'MyFitnessPal alternatives in 2026: 7 apps, free and paid',
  publishedOn: '2026-11-11',
  checkedOn: '2026-11-11',
  answer:
    'The closest MyFitnessPal alternatives are Lose It! for the same simple calorie budget, Cronometer and MyNetDiary for free plans that still include a barcode scanner, and FatSecret for a free diary on phone and web. Yazio and MacroFactor add AI photo logging; MacroFactor has no free plan. Kallo, which we make, drops the database search: you type the meal the way you would say it, and that is a Premium feature once Kallo’s beta ends.',
  disclosure:
    'Kallo is our app. It is listed last, because it is the least like MyFitnessPal. Prices are US prices from each vendor’s site or US App Store listing, checked on 11 November 2026. Each app gets one real drawback, Kallo included.',
  leaveHeading: 'Why people look for a MyFitnessPal alternative',
  leave: [
    'Since 1 October 2022, MyFitnessPal’s barcode scanner needs Premium, and so does its photo meal scan. Premium is $19.99 a month or $79.99 a year on the US App Store. The free plan carries ads: in MyFitnessPal’s words, it stays free “because ads help pay for it”.',
    'Members can add their own foods to the shared database. MyFitnessPal marks reviewed entries with a check mark and says even those can have mistakes. In a 2024 study that entered the same three-day meal records into 16 apps, MyFitnessPal’s energy totals came out about 251 kcal above the reference for a Western diet and 385 kcal below it for an Asian one. Most apps in the study missed in the same directions.',
    'In 2018 an attacker took usernames, email addresses and hashed passwords from about 150 million accounts. MyFitnessPal says payment cards were not affected.',
  ],
  leaveSources: [
    {
      label: 'MyFitnessPal barcode help',
      url: 'https://support.myfitnesspal.com/hc/en-us/articles/360032624771-How-to-use-the-Barcode-Scanner',
    },
    {
      label: 'MyFitnessPal on ads',
      url: 'https://support.myfitnesspal.com/hc/en-us/articles/360032273152-The-ad-free-experience-with-MyfitnessPal-Premium',
    },
    {
      label: 'MyFitnessPal check marks',
      url: 'https://support.myfitnesspal.com/hc/en-us/articles/360032273292-Check-Marked-items',
    },
    {
      label: 'MyFitnessPal on the App Store',
      url: 'https://apps.apple.com/us/app/id341232718',
    },
    LI_2024,
    {
      label: 'MyFitnessPal security FAQ',
      url: 'https://content.myfitnesspal.com/security-information/FAQ.html',
    },
    {
      label: 'The Irish Times (Reuters), 2018',
      url: 'https://www.irishtimes.com/business/technology/under-armour-says-150-million-myfitnesspal-accounts-breached-1.3445507',
    },
  ],
  options: [
    {
      name: 'Lose It!',
      headline: 'the same simple calorie budget',
      logs: 'Search; photo, voice and barcode on Premium',
      free: 'Calorie budget, weight-loss plan, community',
      paid: 'Premium, $39.99 a year',
      platforms: 'iOS, Android',
      bestFor: 'The same daily calorie budget, for half the yearly price.',
      body: [
        'Lose It! works the way MyFitnessPal does: search a database of more than 56 million items and log against a daily budget. Like MyFitnessPal, it keeps the barcode scanner for paying users.',
      ],
      drawback: 'Barcode scanning, photo and voice logging are Premium-only.',
      sources: [
        {
          label: 'Lose It! on the App Store',
          url: 'https://apps.apple.com/us/app/id297368629',
        },
      ],
    },
    {
      name: 'Cronometer',
      headline: 'free barcode scanning and about 95 nutrients',
      logs: 'Search, barcode; photo and voice on Gold',
      free: 'Unlimited barcode scanning, about 95 nutrients, custom recipes',
      paid: 'Gold, $10.99 a month or $59.99 a year',
      platforms: 'iOS, Android, web',
      bestFor: 'Tracking vitamins and minerals as well as calories.',
      body: [
        'Cronometer keeps what MyFitnessPal took away: barcode scanning is free with no limit. It tracks around 95 nutrients for each food and runs on the web as well as phones.',
      ],
      drawback:
        'Free users can’t log by photo or voice. They search or scan a barcode.',
      sources: [
        { label: 'Cronometer Gold', url: 'https://cronometer.com/gold/' },
        {
          label: 'Cronometer free plan',
          url: 'https://cronometer.com/features/free-nutrition-tracking-app.html',
        },
      ],
    },
    {
      name: 'MyNetDiary',
      headline: 'a free barcode scanner and no ads',
      logs: 'Search, barcode, voice; photo on a paid plan',
      free: 'Unlimited diary, barcode scanner, voice logging, no ads',
      paid: 'Not on its website; the US App Store lists Premium at $8.99 to $59.99 without saying the period',
      platforms: 'iOS, Android, web',
      bestFor: 'A free, ad-free diary with barcode scanning.',
      body: [
        'MyNetDiary’s free plan keeps the barcode scanner and voice logging, shows no ads and needs no account. Its database is checked by its own staff.',
      ],
      drawback:
        'Its US prices are not on its website, and its App Store listing and site disagree on which paid plan includes photo logging.',
      sources: [
        {
          label: 'MyNetDiary on the App Store',
          url: 'https://apps.apple.com/us/app/id287529757',
        },
        { label: 'MyNetDiary', url: 'https://www.mynetdiary.com/' },
      ],
    },
    {
      name: 'FatSecret',
      headline: 'a free diary on phone and web',
      logs: 'Search, barcode, photo',
      free: 'The app and its web diary; Premium adds meal plans',
      paid: 'Premium, listed at $38.99 and $59.99 a year',
      platforms: 'iOS, Android, web',
      bestFor: 'A free diary you can also keep in a browser.',
      body: [
        'FatSecret is free to use on phones and the web, with search, a barcode scanner and photo recognition listed among its features. Premium adds dietitian meal plans and water tracking.',
      ],
      drawback:
        'In the 2024 study it had the lowest quality score of 18 apps, with slow screens and crashes, and its photo recognition named 18 of 39 foods.',
      sources: [
        {
          label: 'FatSecret on the App Store',
          url: 'https://apps.apple.com/us/app/id347184248',
        },
        {
          label: 'FatSecret FAQ',
          url: 'https://foods.fatsecret.com/Default.aspx?pa=faq',
        },
        LI_2024,
      ],
    },
    {
      name: 'Yazio',
      headline: 'a free barcode scanner, AI photo logging on Pro',
      logs: 'Photo, voice, text, barcode',
      free: 'Food diary, barcode scanner, fasting timer',
      paid: 'Pro, listed at $23.90 and $47.90 a year',
      platforms: 'iOS, Android',
      bestFor: 'Intermittent fasting, with recipes and a fasting timer.',
      body: [
        'Yazio’s free plan keeps the diary and a barcode scanner, against more than 4 million foods. Pro adds AI photo logging. The US App Store lists two yearly Pro prices.',
      ],
      drawback: 'Photo logging is Pro-only.',
      sources: [
        {
          label: 'Yazio',
          url: 'https://www.yazio.com/en/best-calorie-counter-app',
        },
        {
          label: 'Yazio on the App Store',
          url: 'https://apps.apple.com/us/app/id946099227',
        },
      ],
    },
    {
      name: 'MacroFactor',
      headline: 'AI logging and a weekly coach, no free plan',
      logs: 'Photo, typed description, voice, barcode, nutrition label',
      free: 'None after the trial',
      paid: '$11.99 a month or $71.99 a year',
      platforms: 'iOS, Android',
      bestFor: 'People who lift or diet and want targets that adjust weekly.',
      body: [
        'MacroFactor logs a meal from a photo, a typed description or your voice, against a verified database of more than 1.3 million foods. It moves your calorie and macro targets each week from your weight trend.',
      ],
      drawback: 'There is no free plan once the trial ends.',
      sources: [
        {
          label: 'MacroFactor on the App Store',
          url: 'https://apps.apple.com/us/app/id1553503471',
        },
      ],
    },
    {
      name: 'Kallo',
      headline: 'type the meal instead of searching for it',
      ours: true,
      logs: 'Typed text, barcode, nutrition label',
      free: 'Barcode scanning, manual logging, macros. Typing a meal is Premium. Everything is free while Kallo is in beta',
      paid: 'Premium, $29.99 a year on the web or $34.99 on the App Store, once beta ends',
      platforms: 'iOS, web',
      bestFor: 'People tired of picking the right entry from a list.',
      body: [
        'Kallo logs a meal from the sentence you would say out loud, like “leftover spaghetti bolognese and a side salad”, instead of a search box and a row of database matches. It counts calories and macros from USDA and FAO food data, as a range, not one number. When the words can’t settle a portion, it asks. Typing a meal is part of Premium; the free plan keeps barcode scanning and manual logging.',
        'No independent test has measured Kallo yet. The data below is our own.',
      ],
      drawback:
        'It can’t log a meal from a photo of the plate, only from a nutrition label, and there is no Android app.',
      sources: [
        { label: 'Kallo pricing', url: 'https://kallo.fit/en/pricing' },
        {
          label: 'How describing a meal works',
          url: 'https://kallo.fit/en/docs/logging/describe-a-meal',
        },
        {
          label: 'Kallo on the App Store',
          url: 'https://apps.apple.com/us/app/id6775761392',
        },
      ],
    },
  ],
  extra: {
    heading: 'MyFitnessPal alternatives with a free barcode scanner',
    body: [
      'MyFitnessPal has kept its barcode scanner for Premium since 1 October 2022. Cronometer, MyNetDiary, Yazio and Kallo scan barcodes on their free plans. FatSecret lists its scanner with its general features, not its Premium ones. Lose It! keeps barcode scanning for Premium, and MacroFactor has no free plan.',
    ],
  },
  dataHeading: 'What moves the number more than the database',
  data: (f) =>
    `A database entry can’t know how much oil went into the pan or how full the bowl was. We logged ${f.dishes} everyday meals in Kallo ${f.perDish} common ways each, ${f.meals} meals in all. For the typical dish, the heaviest version had ${f.ratio}× the calories of the lightest. Kallo counted cooking oil in ${f.withOil} of them, and in ${f.unnamed} nobody had mentioned oil, butter or frying. Whichever app you pick, log the portion and the cooking fat.`,
  dataLink: 'See all the numbers',
  methodHeading: 'How we checked',
  method: [
    'Every price and feature comes from the vendor’s own site or its US App Store listing, read on 11 November 2026. Where a listing shows a price without a billing period, we say so. Prices change and differ by country, so check before you pay.',
    'The order follows how close each app is to MyFitnessPal’s search-and-log diary, not a score. The study figures come from Li et al. (Nutrients, 2024), linked under each app. It did not test Kallo.',
  ],
  tryLine: 'Try typing your next meal instead of searching for it.',
};
