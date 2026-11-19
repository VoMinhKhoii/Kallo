import type { FoodLocale } from './slugs';

/**
 * The words every food page and hub share, per locale: headings, the dates
 * and numbers, the hub's own copy and the footer link. Each page's own words
 * are in its `foods/<group>/<slug>.ts`.
 */
export interface FoodPageChrome {
  /** How a kcal count is written: 1,000 or 1.000. */
  formatNumber: (n: number) => string;
  /** The word between the span's ends: "300 to 1,000". */
  spanJoin: string;
  /** The capture date as a sentence names it. */
  formatDate: (date: Date) => string;
  /** The food tables, joined as the locale lists things. */
  formatList: (items: string[]) => string;
  hub: {
    title: (count: number) => string;
    description: (count: number) => string;
    heading: string;
    intro: string;
  };
  loggedOn: (date: string) => string;
  movesHeading: string;
  sourcesHeading: string;
  sourcesBody: (date: string, sources: string) => string;
  moreHeading: string;
  /** "Or browse [all 50 meals]." around the hub link. */
  browse: { before: string; link: (count: number) => string; after: string };
  /** After the lead: the data page, linked with its headline ratio. */
  rangeNote: {
    before: string;
    link: (dishes: number, ratio: string) => string;
    after: string;
  };
  /** Before "More meals": the TDEE calculator, for the reader's own day. */
  dailyNote: { before: string; link: string; after: string };
  similarHeading: string;
  /** The summary table's columns. */
  tableHeads: {
    meal: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  footerLink: string;
  /** The hub's link to the data page that reads every dish together. */
  dataLink: string;
}

export const FOOD_PAGE_CHROME: Record<FoodLocale, FoodPageChrome> = {
  en: {
    formatNumber: (n) => n.toLocaleString('en-US'),
    spanJoin: 'to',
    formatDate: (date) =>
      date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    formatList: (items) =>
      new Intl.ListFormat('en', { type: 'conjunction' }).format(items),
    hub: {
      title: (count) => `Calories in ${count} Everyday Meals, Logged for Real`,
      description: (count) =>
        `How many calories are in a burrito, a poke bowl or pad thai? ${count} everyday meals, each logged in Kallo four ways, with the ingredients that move the number.`,
      heading: 'Calories in everyday meals',
      intro:
        'A meal is not one number. The same burrito is 300 kcal or 1,000 depending on the tortilla, the rice and what goes on top. Each meal is typed into Kallo four ways, from a restaurant plate to a weighed homemade one, the way people describe it. You can see which ingredients move the number.',
    },
    loggedOn: (date) => `Logged in Kallo on ${date}`,
    movesHeading: 'What moves the number',
    sourcesHeading: 'Where these numbers come from',
    sourcesBody: (date, sources) =>
      `Each meal above was typed into Kallo once, on ${date}. Kallo split it into ingredients, estimated the grams, and took calories and macros from ${sources}.`,
    moreHeading: 'More meals',
    browse: {
      before: 'Or browse ',
      link: (count) => `all ${count} meals`,
      after: '.',
    },
    rangeNote: {
      before: 'A range this wide is normal. ',
      link: (dishes, ratio) =>
        `Across all ${dishes} meals, the heaviest version of a typical dish had ${ratio}× the calories of the lightest`,
      after: '.',
    },
    dailyNote: {
      before: 'How this meal fits your day depends on your target: ',
      link: 'work out your daily calories with the TDEE calculator',
      after: '.',
    },
    similarHeading: 'Similar calories',
    tableHeads: {
      meal: 'Meal',
      calories: 'Calories',
      protein: 'Protein',
      carbs: 'Carbs',
      fat: 'Fat',
    },
    footerLink: 'Calories in meals',
    dataLink: 'How much the same meal varies across all these pages',
  },
  vi: {
    formatNumber: (n) => n.toLocaleString('vi-VN'),
    spanJoin: 'đến',
    formatDate: (date) =>
      `ngày ${date.getUTCDate()} tháng ${date.getUTCMonth() + 1} năm ${date.getUTCFullYear()}`,
    formatList: (items) =>
      new Intl.ListFormat('vi', { type: 'conjunction' }).format(items),
    hub: {
      title: (count) => `Calo trong ${count} món ăn Việt, tính từ bữa ăn thật`,
      description: (count) =>
        `Phở bò, cơm tấm, bánh mì, trà sữa bao nhiêu calo? ${count} món quen thuộc, mỗi món ghi vào Kallo bốn cách, kèm những thành phần làm con số lên xuống.`,
      heading: 'Calo trong các món ăn Việt',
      intro:
        'Một món ăn không chỉ có một con số. Cùng là tô phở, tô nhỏ ít bánh khác xa tô đặc biệt thêm quẩy; cùng là dĩa cơm tấm, thêm bì, chả và trứng ốp la là thêm vài trăm calo. Mỗi món được gõ vào Kallo bốn cách, từ hàng quán đến nhà nấu, đúng như người ta vẫn kể, để bạn thấy phần nào làm con số thay đổi.',
    },
    loggedOn: (date) => `Ghi vào Kallo ${date}`,
    movesHeading: 'Phần nào làm con số thay đổi',
    sourcesHeading: 'Các con số lấy từ đâu',
    sourcesBody: (date, sources) =>
      `Mỗi bữa ở trên được gõ vào Kallo một lần, ${date}. Kallo tách bữa ăn thành từng thành phần, ước lượng số gam, rồi lấy calo, đạm, tinh bột và chất béo từ ${sources}.`,
    moreHeading: 'Thêm món',
    browse: {
      before: 'Hoặc ',
      link: (count) => `xem tất cả ${count} món`,
      after: '.',
    },
    rangeNote: {
      before: 'Chênh lệch như vậy là bình thường. ',
      link: (dishes, ratio) =>
        `Trong cả ${dishes} món, bản nhiều calo nhất của một món điển hình gấp ${ratio} lần bản ít nhất`,
      after: '.',
    },
    dailyNote: {
      before: 'Món này nhiều hay vừa còn tùy mức calo mỗi ngày của bạn: ',
      link: 'tính lượng calo mỗi ngày bằng công cụ TDEE',
      after: '.',
    },
    similarHeading: 'Món có lượng calo tương đương',
    tableHeads: {
      meal: 'Bữa',
      calories: 'Calo',
      protein: 'Đạm',
      carbs: 'Tinh bột',
      fat: 'Chất béo',
    },
    footerLink: 'Calo các món ăn',
    dataLink: 'Cùng một món, calo chênh nhau bao nhiêu qua các bữa đã ghi',
  },
};
