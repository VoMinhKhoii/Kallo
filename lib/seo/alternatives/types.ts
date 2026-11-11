import type { MealDataFacts } from '@/lib/seo/meal-data/copy';

/** A page a fact on the page was read from, shown under the app it supports. */
export interface Source {
  label: string;
  url: string;
}

/** One app in the list, as its own vendor and app store describe it. */
export interface AlternativeOption {
  name: string;
  /** The vendor's own site. */
  url: string;
  /** Kallo itself: disclosed in the text, never listed first. */
  ours?: true;
  /** How it logs a meal. */
  logs: string;
  /** What is free. */
  free: string;
  /** The US price of the paid plan, as the source states it. */
  paid: string;
  platforms: string;
  bestFor: string;
  body: string[];
  /** One real drawback, from a source below. */
  drawback: string;
  sources: Source[];
}

export interface AlternativePage {
  metaTitle: string;
  description: string;
  title: string;
  /** The day every price and fact was checked on the vendors' own pages. */
  checkedOn: string;
  /** The answer, in the first 40–80 words, naming Kallo. */
  answer: string;
  disclosure: string;
  tableHeads: { app: string; logs: string; free: string; paid: string };
  leaveHeading: string;
  leave: string[];
  leaveSources: Source[];
  optionLabels: {
    logs: string;
    free: string;
    paid: string;
    platforms: string;
    bestFor: string;
    drawback: string;
    sources: string;
    ours: string;
  };
  options: AlternativeOption[];
  dataHeading: string;
  /** Kallo's own numbers, from the committed food-page captures. */
  data: (facts: MealDataFacts) => string;
  dataLink: string;
  methodHeading: string;
  method: string[];
  tryLine: string;
}
