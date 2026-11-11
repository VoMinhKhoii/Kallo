import type { AlternativeSlug } from '@/lib/seo/alternatives/slugs';
import type { Source } from '@/lib/seo/alternatives/types';
import type { MealDataFacts } from '@/lib/seo/meal-data/copy';

/** One line of the side-by-side table. */
export interface CompareRow {
  label: string;
  kallo: string;
  them: string;
}

/** A "Kallo vs <app>" page. Every fact about the other app has a source. */
export interface ComparePage {
  /** The other app's name, as it writes it. */
  them: string;
  /** Its alternatives page, linked for readers who want every option. */
  alternatives: AlternativeSlug;
  metaTitle: string;
  description: string;
  title: string;
  /** The day the other app's facts were checked on its own pages. */
  checkedOn: string;
  /** The answer, in the first 40–80 words. */
  answer: string;
  disclosure: string;
  rows: CompareRow[];
  sections: { heading: string; body: string[] }[];
  /** Reasons to pick the other app; reasons to pick Kallo. */
  pickThem: string[];
  pickKallo: string[];
  dataHeading: string;
  /** Kallo's own numbers, from the committed food-page captures. */
  data: (facts: MealDataFacts) => string;
  sources: Source[];
  method: string[];
  tryLine: string;
}
