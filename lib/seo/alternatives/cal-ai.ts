import type { AlternativePage, Source } from './types';

/**
 * "Cal AI alternatives". Every price and feature below was read on the
 * vendor's own site or its US App Store listing on `checkedOn`; where a source
 * does not say something (a billing period, a monthly price), the page does
 * not say it either. The facts and their URLs are kept in the SEO routine
 * (`state/alternatives-cal-ai-facts-2026-11-11.json`). Re-check before changing
 * a price, and bump `checkedOn` when you do.
 */

const LI_2024: Source = {
  label: 'Li et al., Nutrients 2024',
  url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11314244/',
};

const OWNERSHIP: Source = {
  label: 'FITT Insider on the Cal AI purchase',
  url: 'https://insider.fitt.co/myfitnesspal-acquires-rival-food-tracker-cal-ai/',
};

const NIH_2026: Source = {
  label: 'NIH test, NUTRITION 2026',
  url: 'https://www.newswise.com/articles/photo-based-calorie-tracking-apps-may-underestimate-energy-in-meals',
};

export const CAL_AI_ALTERNATIVES: AlternativePage = {
  metaTitle: 'Cal AI Alternatives (2026): 7 Apps, Free and Paid',
  description:
    'Seven Cal AI alternatives with photo, voice or typed logging, what each one gives you free, and the US price, checked on the vendors’ own pages.',
  title: 'Cal AI alternatives in 2026: 7 apps, free and paid',
  publishedOn: '2026-11-11',
  checkedOn: '2026-11-11',
  answer:
    'The closest Cal AI alternatives are SnapCalorie for photo logging with a few free logs a day, MacroFactor for photo, typed and voice logging with weekly targets, and Cronometer for the most useful free plan. Yazio, MyFitnessPal and Lose It! keep photo logging behind their paid plans. Kallo, which we make, skips photos: you type the meal the way you would say it, and that is a Premium feature once Kallo’s beta ends.',
  disclosure:
    'Kallo is our app. It is listed last, because it is the least like Cal AI. Prices are US prices from each vendor’s site or US App Store listing, checked on 11 November 2026. Each app gets one real drawback, Kallo included.',
  leaveHeading: 'Why people look for a Cal AI alternative',
  leave: [
    'MyFitnessPal bought Cal AI in March 2026, so one of the apps on this list now owns it. In April 2026 Apple briefly removed Cal AI from the App Store for breaking its in-app purchase and billing rules, and it is back now.',
    'Cal AI logs a meal from a photo, a barcode or a typed description. After a 3-day trial, scan results need a subscription. Its US App Store listing shows plans from $2.99 to $29.99 without saying how long each one lasts.',
    'Its own FAQ puts its accuracy at about 80%. In a preliminary NIH test presented at NUTRITION 2026, Cal AI, MyFitnessPal, Lose It! and Appediet read photos of 102 weighed meals. All four came in about 250 to 345 kcal low per meal on average, and about 30 g low on fat. The test did not publish a number per app.',
  ],
  leaveSources: [
    { label: 'Cal AI', url: 'https://www.calai.app/' },
    {
      label: 'Cal AI on the App Store',
      url: 'https://apps.apple.com/us/app/id6480417616',
    },
    OWNERSHIP,
    {
      label: '9to5Mac on the App Store removal',
      url: 'https://9to5mac.com/2026/04/21/popular-calorie-tracker-briefly-pulled-from-app-store-over-iap-and-billing-violations/',
    },
    NIH_2026,
  ],
  options: [
    {
      name: 'SnapCalorie',
      headline: 'photo logging, 3 free AI logs a day',
      logs: 'Photo, voice, nutrition label',
      free: '3 AI logs a day',
      paid: '$19.99 a month or $149 a year',
      platforms: 'iOS, Android',
      bestFor: 'The closest thing to Cal AI, with a free daily allowance.',
      body: [
        'SnapCalorie is photo-first, like Cal AI. On an iPhone Pro it uses the depth sensor to judge how much food is on the plate. You can also log by voice or scan a label.',
      ],
      drawback:
        'The free plan stops at 3 AI logs a day, and $149 a year is the highest price on this list.',
      sources: [
        {
          label: 'SnapCalorie on the App Store',
          url: 'https://apps.apple.com/us/app/id1574239307',
        },
        { label: 'SnapCalorie FAQ', url: 'https://www.snapcalorie.com/faq' },
      ],
    },
    {
      name: 'MacroFactor',
      headline: 'photo, voice and typed logging with a weekly coach',
      logs: 'Photo, typed description, voice, barcode, nutrition label',
      free: 'None after the trial',
      paid: '$11.99 a month or $71.99 a year',
      platforms: 'iOS, Android',
      bestFor: 'People who lift or diet and want targets that adjust weekly.',
      body: [
        'MacroFactor logs a meal from a photo, a typed description or your voice, against a verified database of more than 1.3 million foods. Its main draw is the coach: it moves your calorie and macro targets each week from your weight trend.',
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
      name: 'Yazio',
      headline: 'photo logging on Pro, plus a fasting timer',
      logs: 'Photo, voice, text, barcode',
      free: 'Food diary, barcode scanner, fasting timer',
      paid: 'Pro, listed at $23.90 and $47.90 a year',
      platforms: 'iOS, Android',
      bestFor: 'Intermittent fasting, with recipes and a fasting timer.',
      body: [
        'Yazio logs a meal from a photo, your voice, typed text or a barcode, against more than 4 million foods. The free plan keeps the diary and barcode scanner. The US App Store lists two yearly Pro prices.',
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
      name: 'Cronometer',
      headline: 'the most useful free plan',
      logs: 'Search, barcode; photo and voice on Gold',
      free: 'Unlimited barcode scanning, about 95 nutrients, custom recipes',
      paid: 'Gold, $10.99 a month or $59.99 a year',
      platforms: 'iOS, Android, web',
      bestFor: 'Tracking vitamins and minerals as well as calories.',
      body: [
        'Cronometer has the most useful free plan here: barcode scanning with no limit and around 95 nutrients for each food. AI photo and voice logging come with Gold.',
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
      name: 'MyFitnessPal',
      headline: 'the biggest database, and Cal AI’s owner',
      logs: 'Search; barcode, photo and voice on Premium',
      free: 'Calorie, weight and exercise tracking by search',
      paid: 'Premium, $19.99 a month or $79.99 a year',
      platforms: 'iOS, Android, web',
      bestFor: 'Packaged and restaurant food, from 20 million entries.',
      body: [
        'MyFitnessPal has the biggest database on this list, restaurants included, and has owned Cal AI since March 2026. In a 2024 study its photo scan named 38 of 39 foods. Photo, voice and barcode logging are paid.',
      ],
      drawback:
        'Barcode scanning, photo and voice logging are all Premium-only.',
      sources: [
        {
          label: 'MyFitnessPal Premium',
          url: 'https://www.myfitnesspal.com/premium',
        },
        {
          label: 'MyFitnessPal on the App Store',
          url: 'https://apps.apple.com/us/app/id341232718',
        },
        OWNERSHIP,
        LI_2024,
      ],
    },
    {
      name: 'Lose It!',
      headline: 'a simple daily calorie budget',
      logs: 'Search; photo, voice and barcode on Premium',
      free: 'Calorie budget, weight-loss plan, community',
      paid: 'Premium, $39.99 a year',
      platforms: 'iOS, Android',
      bestFor: 'Beginners who want a simple daily budget.',
      body: [
        'Lose It! gives you a daily calorie budget and a community around it. Its paid plan adds photo, voice and barcode logging.',
      ],
      drawback:
        'In the same 2024 study, its photo recognition named 18 of 39 foods. That tied with FatSecret for the fewest of the seven apps tested. The study used 2024 versions of each app.',
      sources: [
        {
          label: 'Lose It! on the App Store',
          url: 'https://apps.apple.com/us/app/id297368629',
        },
        LI_2024,
      ],
    },
    {
      name: 'Kallo',
      headline: 'type the meal instead of photographing it',
      ours: true,
      logs: 'Typed text, barcode, nutrition label',
      free: 'Barcode scanning, manual logging, macros. Typing a meal is Premium. Everything is free while Kallo is in beta',
      paid: 'Premium, $29.99 a year on the web or $34.99 on the App Store, once beta ends',
      platforms: 'iOS, web',
      bestFor: 'People who would rather type a meal than photograph it.',
      body: [
        'Kallo logs a meal from the sentence you would say out loud, like “leftover spaghetti bolognese and a side salad”. It splits that into ingredients and counts calories and macros from USDA and FAO food data, as a range, not one number. When the words can’t settle a portion, it asks. Typing a meal is part of Premium; the free plan keeps barcode scanning and manual logging.',
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
    heading: 'Cal AI alternatives on Android',
    body: [
      'Every app here except Kallo has an Android app. Of those, only SnapCalorie logs a meal from a photo for free, up to 3 times a day. Kallo has no Android app, but it works in the browser on an Android phone at kallo.fit.',
    ],
  },
  dataHeading: 'What moves the number more than the photo',
  data: (f) =>
    `A photo can’t see the oil in the pan or how full the bowl was. We logged ${f.dishes} everyday meals in Kallo ${f.perDish} common ways each, ${f.meals} meals in all. For the typical dish, the heaviest version had ${f.ratio}× the calories of the lightest. Kallo counted cooking oil in ${f.withOil} of them, and in ${f.unnamed} nobody had mentioned oil, butter or frying. Whichever app you pick, say the portion and the cooking fat.`,
  dataLink: 'See all the numbers',
  methodHeading: 'How we checked',
  method: [
    'Every price and feature comes from the vendor’s own site or its US App Store listing, read on 11 November 2026. Where a listing shows a price without a billing period, we say so. Prices change and differ by country, so check before you pay.',
    'The order follows how close each app is to Cal AI’s photo-first logging, not a score. The accuracy figures come from two published tests, linked under each app. Neither tested Kallo.',
  ],
  tryLine: 'Try typing your next meal instead of photographing it.',
};
