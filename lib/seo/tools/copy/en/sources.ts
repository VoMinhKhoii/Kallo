import type { ToolSource } from '../../types';

/** The papers the English pages cite, checked against PubMed on 2026-11-02. */
export const SOURCES = {
  mifflin: {
    label:
      'Mifflin et al. (1990), A new predictive equation for resting energy expenditure in healthy individuals',
    href: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  },
  frankenfield: {
    label:
      'Frankenfield et al. (2005), Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults',
    href: 'https://pubmed.ncbi.nlm.nih.gov/15883556/',
  },
  hall: {
    label:
      'Hall et al. (2011), Quantification of the effect of energy imbalance on bodyweight, The Lancet',
    href: 'https://pubmed.ncbi.nlm.nih.gov/21872751/',
  },
  issn: {
    label:
      'Jäger et al. (2017), International Society of Sports Nutrition position stand: protein and exercise',
    href: 'https://pubmed.ncbi.nlm.nih.gov/28642676/',
  },
  morton: {
    label:
      'Morton et al. (2018), Protein supplementation and resistance training: a meta-analysis, British Journal of Sports Medicine',
    href: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
  },
  dri: {
    label:
      'Institute of Medicine (2005), Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids',
    href: 'https://nap.nationalacademies.org/catalog/10490',
  },
  whoAsia: {
    label:
      'WHO expert consultation (2004), Appropriate body-mass index for Asian populations, The Lancet',
    href: 'https://pubmed.ncbi.nlm.nih.gov/14726171/',
  },
  asiaPacific: {
    label:
      'WHO Western Pacific Region, IASO and IOTF (2000), The Asia-Pacific perspective: redefining obesity and its treatment',
    href: 'https://iris.who.int/items/a74d8440-5c1d-4237-9559-3f729058587b',
  },
} satisfies Record<string, ToolSource>;
