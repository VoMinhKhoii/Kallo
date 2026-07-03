/**
 * Curated country→dishes data for the v3 cuisine globe, plus the polygon
 * palette shared by the scene, tour cards, and panel so they never drift.
 *
 * Keys are Natural Earth `ADM0_A3` codes — NOT `ISO_A3`, which NE 110m
 * leaves as "-99" for France and Norway. Dish copy follows the product
 * voice: adjustments read like a regular's order (in the local language
 * where a local would), and `logExample` is the exact sentence you'd type
 * into Nhẩm. Content researched per-country (2026-07) with the brief
 * "dishes locals actually order, not tourist clichés".
 */

export interface GlobeDish {
  name: string;
  /** One evocative line on what it is. */
  description: string;
  /** Frequently-seen tweaks, in a food-logger's voice. */
  adjustments: string;
  /** The teach-the-app line: log it like you'd say it. */
  logExample: string;
}

export interface GlobeCountry {
  /** Natural Earth ADM0_A3 code. */
  iso: string;
  /** English display name (lab pages are hardcoded EN). */
  name: string;
  /** Flag emoji — the tour card's instant "that's my country" signal. */
  flag: string;
  /** One line on why this kitchen matters. */
  note: string;
  dishes: GlobeDish[];
}

/**
 * Ceramic-globe palette in nham clay tones — deliberately deeper than the
 * cream page ground (#FEFBF6) so the sphere reads as an object, not a
 * watermark. Land sits solid tan on a parchment ocean; hover goes darker
 * still.
 */
export const GLOBE_PALETTE = {
  sphere: '#F1E4CC',
  atmosphere: '#D9BE93',
  capBase: '#D4BB8E',
  capFeatured: '#C9A87C',
  capHovered: '#A9834E',
  side: 'rgba(169, 131, 78, 0.35)',
  stroke: '#B69A6E',
} as const;

export const GLOBE_COUNTRIES: Record<string, GlobeCountry> = {
  // ————— Asia —————
  VNM: {
    iso: 'VNM',
    name: 'Vietnam',
    flag: '🇻🇳',
    note: 'Herb-piled bowls and overnight broths, north to south.',
    dishes: [
      {
        name: 'Phở bò',
        description:
          'Rice noodles in slow-simmered beef-bone broth, star anise and charred ginger.',
        adjustments: 'hay thêm quẩy, nước béo; ít bánh khi cutting',
        logExample: '1 tô phở bò tái + quẩy',
      },
      {
        name: 'Bún chả',
        description:
          'Char-grilled pork patties and belly in fish-sauce dip, cold vermicelli, herbs.',
        adjustments: 'hay gọi thêm nem rán, thêm rau sống; bớt bún khi cutting',
        logExample: '1 suất bún chả + 2 nem rán',
      },
      {
        name: 'Cơm tấm',
        description:
          'Broken rice with lemongrass-grilled pork chop, mỡ hành, pickles, fish sauce.',
        adjustments: 'thêm trứng ốp la; bỏ mỡ hành, bớt cơm khi cutting',
        logExample: '1 dĩa cơm tấm sườn bì chả + trứng ốp la',
      },
    ],
  },
  JPN: {
    iso: 'JPN',
    name: 'Japan',
    flag: '🇯🇵',
    note: 'Season-obsessed precision, from corner ramen to konbini shelves.',
    dishes: [
      {
        name: 'Ramen',
        description:
          'Wheat noodles in rich broth — tonkotsu, shoyu, miso — with chashu and ajitama.',
        adjustments:
          'often + extra chashu, ajitama; kaedama refill, less broth when cutting',
        logExample: '1 bowl tonkotsu ramen with extra chashu',
      },
      {
        name: 'Kare raisu',
        description:
          "Japan's thick, mild curry over rice — the weeknight staple in every home.",
        adjustments:
          'often + tonkatsu on top, extra fukujinzuke; less rice when cutting',
        logExample: '1 plate katsu curry, large rice',
      },
    ],
  },
  CHN: {
    iso: 'CHN',
    name: 'China',
    flag: '🇨🇳',
    note: 'Eight great cuisines, one wok — Sichuan fire to Cantonese steam.',
    dishes: [
      {
        name: 'Lánzhōu beef noodles',
        description:
          'Hand-pulled noodles in clear beef broth — radish, chili oil, cilantro.',
        adjustments:
          'pick your noodle width; extra beef, chili oil; less oil when cutting',
        logExample: '1 bowl lanzhou beef noodles, thin pull, extra chili oil',
      },
      {
        name: 'Mápó dòufu',
        description:
          'Silken tofu in fiery Sichuan doubanjiang sauce, numbing mala peppercorn.',
        adjustments:
          'always over rice, extra huajiao; less oil, more tofu when cutting',
        logExample: 'mapo tofu with 1 bowl of rice',
      },
    ],
  },
  IND: {
    iso: 'IND',
    name: 'India',
    flag: '🇮🇳',
    note: 'A spice-route subcontinent; every state a different pantry.',
    dishes: [
      {
        name: 'Masala dosa',
        description:
          'Crisp fermented rice-lentil crepe wrapped around spiced potato, with chutneys.',
        adjustments:
          'often ghee roast upgrade, extra sambar; skip the ghee when cutting',
        logExample: '1 masala dosa with sambar and coconut chutney',
      },
      {
        name: 'Hyderabadi biryani',
        description:
          'Layered basmati and marinated meat cooked dum-style with saffron, fried onion.',
        adjustments:
          'often + raita and mirchi ka salan; half plate, less rice when cutting',
        logExample: '1 plate chicken biryani with raita',
      },
    ],
  },
  THA: {
    iso: 'THA',
    name: 'Thailand',
    flag: '🇹🇭',
    note: 'Sweet, sour, salty, hot — balanced in a single street-side wok.',
    dishes: [
      {
        name: 'Phat kaphrao',
        description:
          'Holy-basil pork stir-fry over rice, runny fried egg on top — the default order.',
        adjustments:
          'kai dao on top is a must; extra spicy, less oil and rice when cutting',
        logExample: 'pad kra pao moo with fried egg, extra spicy',
      },
      {
        name: 'Som tam',
        description:
          "Green papaya pounded with chili, lime, fish sauce — Isaan's fiery salad.",
        adjustments:
          'chilies counted out loud; often + sticky rice and grilled chicken',
        logExample: 'som tam thai with 2 chilies + sticky rice',
      },
    ],
  },
  KOR: {
    iso: 'KOR',
    name: 'South Korea',
    flag: '🇰🇷',
    note: 'Fermentation as national art, shared over sizzling tabletops.',
    dishes: [
      {
        name: 'Kimchi-jjigae',
        description:
          'Bubbling stew of aged kimchi and pork, served with rice and banchan.',
        adjustments:
          'often + extra pork or tofu, ramyeon in; less rice when cutting',
        logExample: 'kimchi jjigae with rice and banchan',
      },
      {
        name: 'Samgyeopsal',
        description:
          'Thick pork belly grilled at the table, wrapped in lettuce with ssamjang.',
        adjustments:
          'wrap it — lettuce over rice; + soju; skip the fried-rice finish when cutting',
        logExample: 'samgyeopsal 2 servings with lettuce wraps and soju',
      },
    ],
  },
  IDN: {
    iso: 'IDN',
    name: 'Indonesia',
    flag: '🇮🇩',
    note: 'Seventeen thousand islands, one shared love of sambal.',
    dishes: [
      {
        name: 'Nasi goreng',
        description: 'Sweet-soy fried rice, smoky from the wok.',
        adjustments: 'often + fried egg on top, krupuk on the side',
        logExample: 'nasi goreng + telur',
      },
      {
        name: 'Sate ayam',
        description: 'Charcoal chicken skewers under peanut sauce.',
        adjustments: 'five to ten skewers, lontong rice cakes alongside',
        logExample: '5 chicken satay + peanut sauce',
      },
    ],
  },
  // ————— Europe —————
  ITA: {
    iso: 'ITA',
    name: 'Italy',
    flag: '🇮🇹',
    note: 'Twenty regions, twenty kitchens — pasta is only the beginning.',
    dishes: [
      {
        name: 'Spaghetti alla carbonara',
        description:
          'Roman pasta slicked in egg, pecorino and guanciale — no cream, ever.',
        adjustments:
          'often + extra pecorino, guanciale doubled; smaller portion when cutting',
        logExample: 'a plate of spaghetti carbonara at lunch',
      },
      {
        name: 'Tagliatelle al ragù',
        description:
          "Bologna's slow-simmered meat ragù draped over fresh egg tagliatelle.",
        adjustments:
          'extra parmigiano on top; half portion plus salad when cutting',
        logExample: 'tagliatelle al ragù, normal serving',
      },
    ],
  },
  FRA: {
    iso: 'FRA',
    name: 'France',
    flag: '🇫🇷',
    note: 'From bistro counters to boulangeries, technique is the religion.',
    dishes: [
      {
        name: 'Bœuf bourguignon',
        description:
          'Beef braised low in Burgundy red with lardons, mushrooms and pearl onions.',
        adjustments:
          'often + crusty baguette to mop; skip seconds of sauce when cutting',
        logExample: 'boeuf bourguignon with a piece of baguette',
      },
      {
        name: 'Croissant au beurre',
        description:
          'Shatter-crisp, butter-laminated layers — the Parisian breakfast ritual.',
        adjustments: 'often + café crème; just one, or half when cutting',
        logExample: 'a croissant and a café crème this morning',
      },
    ],
  },
  ESP: {
    iso: 'ESP',
    name: 'Spain',
    flag: '🇪🇸',
    note: 'Tapas hours, Basque grills and rice pans — eating is social here.',
    dishes: [
      {
        name: 'Tortilla de patatas',
        description:
          "Thick potato-and-egg omelette, jammy in the middle — Spain's eternal tapa.",
        adjustments:
          'con or sin cebolla — pick a side; one pincho slice keeps it light',
        logExample: 'a slice of tortilla de patatas as a snack',
      },
      {
        name: 'Paella valenciana',
        description:
          'Saffron rice cooked wide and thin, crowned with chicken, rabbit and beans.',
        adjustments:
          'fight for the socarrat; often + alioli; smaller scoop when cutting',
        logExample: 'paella valenciana for Sunday lunch, one serving',
      },
    ],
  },
  GRC: {
    iso: 'GRC',
    name: 'Greece',
    flag: '🇬🇷',
    note: 'Sun-drunk simplicity — olive oil, oregano and the charcoal grill.',
    dishes: [
      {
        name: 'Souvláki',
        description:
          'Charcoal-grilled pork skewers tucked into warm pita with tzatziki and tomato.',
        adjustments:
          'often + patates inside the wrap; skip the pita when cutting',
        logExample: 'a pork souvlaki wrap with tzatziki',
      },
      {
        name: 'Horiátiki saláta',
        description:
          'The village salad — tomatoes, cucumber, olives and a slab of feta, no lettuce.',
        adjustments: 'extra feta always; go easy on the oil pour when cutting',
        logExample: 'horiatiki salad with extra feta',
      },
    ],
  },
  TUR: {
    iso: 'TUR',
    name: 'Turkey',
    flag: '🇹🇷',
    note: 'Ottoman court dishes meet street grills across two continents.',
    dishes: [
      {
        name: 'Lahmacun',
        description:
          'Paper-thin flatbread baked with spiced minced lamb, eaten rolled with parsley.',
        adjustments:
          'roll it with parsley and lemon; + ayran; just one when cutting',
        logExample: 'two lahmacun with ayran',
      },
      {
        name: 'Menemen',
        description:
          'Eggs softly scrambled into simmering tomatoes and peppers, pan to table.',
        adjustments:
          'the eternal onion debate — soğanlı or not; + bread for dipping',
        logExample: 'menemen with a slice of bread for breakfast',
      },
    ],
  },
  // ————— Africa —————
  MAR: {
    iso: 'MAR',
    name: 'Morocco',
    flag: '🇲🇦',
    note: 'Spice-market depth — sweet meets savoury in every clay pot.',
    dishes: [
      {
        name: 'Chicken tajine',
        description:
          'Chicken slow-steamed under a clay cone with preserved lemon and olives.',
        adjustments:
          'scoop with khobz, not cutlery; go light on the bread when cutting',
        logExample: 'chicken tajine with preserved lemon and some khobz',
      },
      {
        name: 'Couscous',
        description:
          'Friday couscous — steamed semolina piled with seven vegetables and lamb.',
        adjustments:
          'often + a ladle of broth over the top; smaller mound when cutting',
        logExample: 'Friday couscous with lamb and vegetables',
      },
    ],
  },
  ETH: {
    iso: 'ETH',
    name: 'Ethiopia',
    flag: '🇪🇹',
    note: 'One shared injera, a dozen stews — eating is communal by design.',
    dishes: [
      {
        name: 'Doro wat',
        description:
          'Chicken simmered for hours in berbere and spiced butter, an egg buried inside.',
        adjustments:
          'always on injera; extra injera rolls add up fast when cutting',
        logExample: 'doro wat with two rolls of injera',
      },
      {
        name: 'Shiro',
        description:
          'Silky chickpea-flour stew, the everyday and fasting-day staple.',
        adjustments:
          "tegamino-style if you're hungry; less injera when cutting",
        logExample: 'shiro wat with injera for lunch',
      },
    ],
  },
  NGA: {
    iso: 'NGA',
    name: 'Nigeria',
    flag: '🇳🇬',
    note: 'Bold, peppery and proud — the jollof wars are no joke.',
    dishes: [
      {
        name: 'Jollof rice',
        description:
          'Party rice steamed in a smoky tomato-pepper base — best with firewood char.',
        adjustments:
          'often + fried plantain and chicken; skip the extra scoop when cutting',
        logExample: 'jollof rice with fried plantain and grilled chicken',
      },
      {
        name: 'Egusi soup',
        description: 'Rich, nutty melon-seed soup, swallowed with pounded yam.',
        adjustments:
          'with pounded yam or eba; smaller swallow portion when cutting',
        logExample: 'egusi soup with a wrap of pounded yam',
      },
    ],
  },
  SEN: {
    iso: 'SEN',
    name: 'Senegal',
    flag: '🇸🇳',
    note: "West Africa's table — teranga hospitality served around one bowl.",
    dishes: [
      {
        name: 'Ceebu jën',
        description:
          'The national dish — broken rice, stuffed fish and vegetables in tomato.',
        adjustments:
          'everyone eats from one bowl; go easy on the oily rice when cutting',
        logExample: 'ceebu jën for lunch, one good serving',
      },
      {
        name: 'Yassa poulet',
        description:
          'Grilled chicken smothered in slow-cooked onions, lemon and mustard.',
        adjustments:
          'extra onion sauce is the point; less rice under it when cutting',
        logExample: 'yassa poulet with rice',
      },
    ],
  },
  // ————— Americas —————
  MEX: {
    iso: 'MEX',
    name: 'Mexico',
    flag: '🇲🇽',
    note: 'Layered like its history — masa, chile and fire in every region.',
    dishes: [
      {
        name: 'Tacos al pastor',
        description:
          'Chile-marinated pork shaved off the spinning trompo, crowned with pineapple.',
        adjustments:
          'con todo — cilantro, onion, salsa; three not five when cutting',
        logExample: '3 tacos al pastor con todo',
      },
      {
        name: 'Chilaquiles verdes',
        description:
          'Fried tortillas softened in green salsa, with crema, cheese and egg.',
        adjustments:
          'often + a fried egg or shredded chicken; light on the crema when cutting',
        logExample: 'chilaquiles verdes with a fried egg for breakfast',
      },
    ],
  },
  PER: {
    iso: 'PER',
    name: 'Peru',
    flag: '🇵🇪',
    note: 'Coast, Andes and Amazon — plus Japan and China at the table.',
    dishes: [
      {
        name: 'Ceviche',
        description:
          'Raw fish cured minutes in leche de tigre, with red onion and ají limo.',
        adjustments:
          'with sweet potato + choclo on the side; drink the leche de tigre',
        logExample: 'ceviche de pescado with sweet potato',
      },
      {
        name: 'Lomo saltado',
        description:
          'Beef wok-fried with soy, tomatoes and fries — chifa heritage on one plate.',
        adjustments:
          'fries mixed in AND rice beside; drop the rice when cutting',
        logExample: 'lomo saltado, skipped the rice',
      },
    ],
  },
  BRA: {
    iso: 'BRA',
    name: 'Brazil',
    flag: '🇧🇷',
    note: 'Continental appetite — Amazonian fruit to smoky churrasco.',
    dishes: [
      {
        name: 'Feijoada',
        description:
          'Black beans and pork simmered all Saturday, with rice, orange and farofa.',
        adjustments:
          '+ farofa, couve and orange slices; half a bowl when cutting',
        logExample: 'feijoada completa on Saturday, one bowl',
      },
      {
        name: 'Pão de queijo',
        description:
          'Chewy cheese puffs from Minas, warm from the oven, gone in minutes.',
        adjustments:
          'with morning coffee; never just one — count them honestly',
        logExample: '4 pão de queijo with coffee',
      },
    ],
  },
  USA: {
    iso: 'USA',
    name: 'United States',
    flag: '🇺🇸',
    note: 'An immigrant potluck perfected into diners, delis and BBQ pits.',
    dishes: [
      {
        name: 'Cheeseburger',
        description:
          'Smashed patty, melted American cheese, pickles — backyard-to-diner icon.',
        adjustments:
          'often + fries; skip the second patty or the bun when cutting',
        logExample: 'a double cheeseburger with fries',
      },
      {
        name: 'Smoked brisket',
        description:
          'Beef smoked over oak for twelve-plus hours until it bends and glistens.',
        adjustments:
          'by the half-pound with pickles and white bread; skip the sweet sauce',
        logExample: 'half a pound of smoked brisket with pickles',
      },
    ],
  },
  ARG: {
    iso: 'ARG',
    name: 'Argentina',
    flag: '🇦🇷',
    note: 'Beef raised on the pampas, grilled with almost religious calm.',
    dishes: [
      {
        name: 'Asado',
        description:
          'The Sunday ritual — ribs, chorizo and sweetbreads over slow wood coals.',
        adjustments:
          'chimichurri always; provoleta first; pace yourself across rounds',
        logExample: 'asado — a chorizo, some ribs and provoleta',
      },
      {
        name: 'Empanadas de carne',
        description:
          'Hand-folded pastries of cut beef, olive and egg — every province claims theirs.',
        adjustments:
          'fried in Salta, baked in BA; two or three, not six when cutting',
        logExample: '3 empanadas de carne',
      },
    ],
  },
  // ————— Oceania —————
  AUS: {
    iso: 'AUS',
    name: 'Australia',
    flag: '🇦🇺',
    note: 'Immigrant flavors off the barbie; brunch elevated to religion.',
    dishes: [
      {
        name: 'Meat pie',
        description:
          'Flaky handheld pie of minced beef and gravy — footy food, servo staple.',
        adjustments:
          'always + tomato sauce; pie floater if brave; just one when cutting',
        logExample: '1 meat pie with tomato sauce',
      },
      {
        name: 'Smashed avo on toast',
        description:
          'Sourdough under smashed avocado, feta and lemon — the Melbourne brunch canon.',
        adjustments:
          'often + poached eggs, dukkah; skip the feta, one slice when cutting',
        logExample: 'smashed avo toast with 2 poached eggs',
      },
    ],
  },
  NZL: {
    iso: 'NZL',
    name: 'New Zealand',
    flag: '🇳🇿',
    note: 'Earth-oven smoke, dairy-rich comfort, ocean on every plate.',
    dishes: [
      {
        name: 'Hāngī',
        description:
          'Meat and kūmara steamed for hours in a Māori earth oven — smoky and communal.',
        adjustments:
          'heavy on kūmara and stuffing; smaller plate, skip the bread when cutting',
        logExample: '1 hāngī plate with pork, kūmara and stuffing',
      },
      {
        name: 'Mince & cheese pie',
        description:
          "NZ's bakery icon — savoury minced beef and molten cheese in crisp pastry.",
        adjustments:
          'grab an L&P with it; steak & cheese swap; just the one when cutting',
        logExample: '1 mince and cheese pie + L&P',
      },
    ],
  },
};

export const FEATURED_ISOS: ReadonlySet<string> = new Set(
  Object.keys(GLOBE_COUNTRIES)
);
