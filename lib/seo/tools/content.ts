import type { Locale } from '@/i18n/config';
import { bmiCopy as enBmi } from './copy/en/bmi';
import { deficit as enDeficit } from './copy/en/deficit';
import { macro as enMacro } from './copy/en/macro';
import { protein as enProtein } from './copy/en/protein';
import { hub as enHub, ui as enUi } from './copy/en/site';
import { tdee as enTdee } from './copy/en/tdee';
import { bmiCopy as viBmi } from './copy/vi/bmi';
import { deficit as viDeficit } from './copy/vi/deficit';
import { macro as viMacro } from './copy/vi/macro';
import { protein as viProtein } from './copy/vi/protein';
import { hub as viHub, ui as viUi } from './copy/vi/site';
import { tdee as viTdee } from './copy/vi/tdee';
import type { ToolSlug } from './slugs';
import type { HubCopy, ToolCopy, ToolUi } from './types';

/**
 * Every word on the calculator pages, by locale. The Vietnamese copy is
 * written for Vietnamese searchers ("tính TDEE", "BMI châu Á"), not translated
 * from the English, so the two can differ in examples and emphasis.
 */
export const TOOL_COPY: Record<Locale, Record<ToolSlug, ToolCopy>> = {
  en: {
    'tdee-calculator': enTdee,
    'calorie-deficit-calculator': enDeficit,
    'macro-calculator': enMacro,
    'protein-calculator': enProtein,
    'bmi-calculator': enBmi,
  },
  vi: {
    'tdee-calculator': viTdee,
    'calorie-deficit-calculator': viDeficit,
    'macro-calculator': viMacro,
    'protein-calculator': viProtein,
    'bmi-calculator': viBmi,
  },
};

export const HUB_COPY: Record<Locale, HubCopy> = { en: enHub, vi: viHub };

export const TOOL_UI: Record<Locale, ToolUi> = { en: enUi, vi: viUi };
