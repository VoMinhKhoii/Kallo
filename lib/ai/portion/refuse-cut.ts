import { fold } from '@/lib/ai/portion/lexicon/fold';

export type RefuseCutClass =
  | 'rib'
  | 'wing'
  | 'whole_fish'
  | 'fish_section'
  | 'shell_on_shrimp'
  | 'bone_in_leg'
  | 'whole_crab'
  | 'egg_in_shell';

export interface RefuseBand {
  cutClass: RefuseCutClass;
  low: number;
  high: number;
}

interface NormalizedNames {
  exact: string;
  folded: string;
}

function normalizedNames(
  canonicalName: string,
  rawName: string
): NormalizedNames {
  const exact = `${canonicalName} ${rawName}`
    .toLocaleLowerCase('vi-VN')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { exact, folded: fold(exact, { collapseWhitespace: true }) };
}

/** Keyword-only cut classifier. Order is deliberate for specific classes. */
export function classifyRefuseCut(
  canonicalName: string,
  rawName: string
): RefuseBand | null {
  const { exact, folded } = normalizedNames(canonicalName, rawName);
  const porkChop =
    exact.includes('cơm tấm sườn') ||
    folded.includes('com tam suon') ||
    exact.includes('cốt lết') ||
    folded.includes('cot let') ||
    folded.includes('cotlet') ||
    exact.includes('pork chop');
  if (
    !porkChop &&
    (exact.includes('sườn') ||
      folded.includes('suon') ||
      /\b(?:spare )?ribs?\b/.test(exact))
  ) {
    return { cutClass: 'rib', low: 40, high: 60 };
  }
  // Do not fold this Vietnamese keyword. `cánh gà` (wing) and `canh gà`
  // (chicken soup) both fold to `canh ga`, so the folded form is ambiguous.
  if (exact.includes('cánh gà') || /\b(?:chicken )?wings?\b/.test(exact)) {
    return { cutClass: 'wing', low: 30, high: 50 };
  }
  if (
    exact.includes('cá nguyên con') ||
    folded.includes('ca nguyen con') ||
    folded.includes('nguyen con ca') ||
    folded.includes('1 con ca') ||
    exact.includes('whole fish')
  ) {
    return { cutClass: 'whole_fish', low: 35, high: 50 };
  }
  if (
    exact.includes('khúc cá') ||
    folded.includes('khuc ca') ||
    exact.includes('khoanh cá') ||
    folded.includes('khoanh ca') ||
    exact.includes('fish steak') ||
    exact.includes('fish section')
  ) {
    return { cutClass: 'fish_section', low: 15, high: 30 };
  }
  const shrimp =
    exact.includes('tôm') ||
    folded.includes('tom') ||
    /\b(?:shrimp|prawn)s?\b/.test(exact);
  const shellOn =
    exact.includes('vỏ') ||
    /(?:^|\s)vo(?:\s|$)/.test(folded) ||
    /\bshell on\b/.test(exact) ||
    exact.includes('shell-on');
  if (shrimp && shellOn) {
    return { cutClass: 'shell_on_shrimp', low: 35, high: 55 };
  }
  const wholeCrab =
    folded.includes('cua nguyen con') ||
    folded.includes('ghe nguyen con') ||
    folded.includes('nguyen con cua') ||
    folded.includes('nguyen con ghe') ||
    /\b(?:\d+ )?con (?:cua|ghe)\b/.test(folded) ||
    /\b(?:whole crab|whole blue crab)s?\b/.test(exact);
  if (wholeCrab) {
    return { cutClass: 'whole_crab', low: 55, high: 75 };
  }
  const egg =
    exact.includes('trứng') ||
    folded.includes('trung') ||
    /\beggs?\b/.test(exact);
  const inShell =
    exact.includes('nguyên vỏ') ||
    folded.includes('nguyen vo') ||
    exact.includes('còn vỏ') ||
    folded.includes('con vo') ||
    exact.includes('in shell');
  if (egg && inShell) {
    return { cutClass: 'egg_in_shell', low: 10, high: 15 };
  }
  const vietnameseLeg = exact.includes('đùi') || folded.includes('dui');
  const porkKnuckle = exact.includes('chân giò');
  const drumstick = /\bdrumsticks?\b/.test(exact);
  const englishLeg = /\b(?:thigh|leg)s?\b/.test(exact);
  const boneIn =
    exact.includes('bone in') ||
    exact.includes('bone-in') ||
    exact.includes('xương') ||
    folded.includes('xuong');
  if (porkKnuckle || drumstick || ((vietnameseLeg || englishLeg) && boneIn)) {
    return { cutClass: 'bone_in_leg', low: 25, high: 35 };
  }
  // Bare stock bones ("xương heo", "cục xương") deliberately have NO keyword
  // class: a runtime band misfired on bone broth ("nước dùng xương heo") in
  // real-meal replay. The prompt's refuse anchor guides the model instead;
  // deterministic protection is planned as row-level `refuse_reference_form`
  // plus a structured servedForm from the model, not name matching.
  return null;
}
