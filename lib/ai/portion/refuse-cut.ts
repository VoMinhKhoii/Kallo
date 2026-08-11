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

function normalizedName(canonicalName: string, rawName: string): string {
  const normalized = `${canonicalName} ${rawName}`
    .toLocaleLowerCase('vi-VN')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const folded = normalized
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd');
  return `${normalized} ${folded}`;
}

/** Keyword-only cut classifier. Order is deliberate for specific classes. */
export function classifyRefuseCut(
  canonicalName: string,
  rawName: string
): RefuseBand | null {
  const name = normalizedName(canonicalName, rawName);
  const porkChop =
    name.includes('cơm tấm sườn') ||
    name.includes('com tam suon') ||
    name.includes('cốt lết') ||
    name.includes('cot let') ||
    name.includes('cotlet') ||
    name.includes('pork chop');
  if (
    !porkChop &&
    (name.includes('sườn') ||
      name.includes('suon') ||
      /\b(?:spare )?ribs?\b/.test(name))
  ) {
    return { cutClass: 'rib', low: 40, high: 60 };
  }
  if (
    name.includes('cánh') ||
    name.includes('canh ga') ||
    /\bwings?\b/.test(name)
  ) {
    return { cutClass: 'wing', low: 30, high: 50 };
  }
  if (
    name.includes('cá nguyên con') ||
    name.includes('ca nguyen con') ||
    name.includes('nguyen con ca') ||
    name.includes('1 con ca') ||
    name.includes('whole fish')
  ) {
    return { cutClass: 'whole_fish', low: 35, high: 50 };
  }
  if (
    name.includes('khúc cá') ||
    name.includes('khuc ca') ||
    name.includes('khoanh cá') ||
    name.includes('khoanh ca') ||
    name.includes('fish steak') ||
    name.includes('fish section')
  ) {
    return { cutClass: 'fish_section', low: 15, high: 30 };
  }
  const shrimp =
    name.includes('tôm') ||
    name.includes('tom') ||
    /\b(?:shrimp|prawn)s?\b/.test(name);
  const shellOn =
    name.includes('vỏ') ||
    /(?:^|\s)vo(?:\s|$)/.test(name) ||
    /\bshell on\b/.test(name) ||
    name.includes('shell-on');
  if (shrimp && shellOn) {
    return { cutClass: 'shell_on_shrimp', low: 35, high: 55 };
  }
  const crab =
    name.includes('ghẹ') ||
    name.includes('ghe') ||
    /(?:^|\s)cua(?:\s|$)/.test(name) ||
    /\bcrabs?\b/.test(name);
  if (crab) {
    return { cutClass: 'whole_crab', low: 55, high: 75 };
  }
  const egg =
    name.includes('trứng') || name.includes('trung') || /\beggs?\b/.test(name);
  const inShell =
    name.includes('nguyên vỏ') ||
    name.includes('nguyen vo') ||
    name.includes('còn vỏ') ||
    name.includes('con vo') ||
    name.includes('in shell');
  if (egg && inShell) {
    return { cutClass: 'egg_in_shell', low: 10, high: 15 };
  }
  const vietnameseLeg = name.includes('đùi');
  const porkKnuckle = name.includes('chân giò');
  const drumstick = /\bdrumsticks?\b/.test(name);
  const englishLeg = /\b(?:thigh|leg)s?\b/.test(name);
  const boneIn =
    name.includes('bone in') ||
    name.includes('bone-in') ||
    name.includes('xương');
  if (porkKnuckle || drumstick || ((vietnameseLeg || englishLeg) && boneIn)) {
    return { cutClass: 'bone_in_leg', low: 25, high: 35 };
  }
  return null;
}
