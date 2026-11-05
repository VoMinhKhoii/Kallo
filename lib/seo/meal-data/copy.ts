import type { FoodLocale } from '@/lib/seo/food-pages/slugs';
import type { KindKey } from './stats';

export interface MealDataFacts {
  meals: number;
  dishes: number;
  /** Meals logged per dish. */
  perDish: number;
  /** Median heaviest ÷ lightest, one decimal, as the locale writes it. */
  ratio: string;
  withOil: number;
  unnamed: number;
  oilKcal: number;
  /** When the meals were captured: one day, or the first and last. */
  dates: { from: string; to: string };
}

export interface MealDataCopy {
  metaTitle: (f: MealDataFacts) => string;
  description: (f: MealDataFacts) => string;
  title: string;
  lead: (f: MealDataFacts) => string;
  swingsHeading: string;
  swingsLead: string;
  /** "lightest: X · heaviest: Y". */
  swingLine: (lowLabel: string, highLabel: string) => string;
  kindsHeading: string;
  kindsLead: string;
  kinds: Record<KindKey, string>;
  kindLine: (meals: number, median: string, max: string) => string;
  oilHeading: string;
  oilBody: (f: MealDataFacts) => string;
  steadyHeading: string;
  steadyLead: string;
  methodHeading: string;
  method: (f: MealDataFacts) => string[];
  citeHeading: string;
  cite: (f: MealDataFacts, url: string) => string;
  tryLine: string;
}

export const MEAL_DATA_COPY: Record<FoodLocale, MealDataCopy> = {
  en: {
    metaTitle: (f) =>
      `Same Meal, ${f.ratio}× the Calories: ${f.meals} Logged Meals`,
    description: (f) =>
      `We logged ${f.dishes} everyday meals ${f.perDish} ways each. The heaviest version of a typical meal had ${f.ratio}× the calories of the lightest, and cooking oil hid in ${f.unnamed} meals.`,
    title: 'How much the same meal varies',
    lead: (f) =>
      `A calorie table gives one number per dish. We logged ${f.dishes} everyday meals in Kallo ${f.perDish} common ways each, ${f.meals} meals in all, from a small homemade plate to a full restaurant one, each typed the way people describe it. For the typical dish, the heaviest version had ${f.ratio}× the calories of the lightest. That spread, not the table's single number, is what decides whether a day of eating lands on target.`,
    swingsHeading: 'The biggest swings',
    swingsLead:
      'The widest gaps between lightest and heaviest versions, with the portions that explain them.',
    swingLine: (low, high) => `lightest: ${low} · heaviest: ${high}`,
    kindsHeading: 'What moves the number',
    kindsLead:
      'Ingredients with the most calories per serving, and how many meals included them.',
    kinds: {
      noodles: 'Pasta and noodles',
      rice: 'Rice',
      bread: 'Bread, buns and tortillas',
      cheese: 'Cheese',
      oil: 'Cooking oil',
      butter: 'Butter',
      sauce: 'Sauces and dressings',
      sugar: 'Sugar and condensed milk',
      broth: 'Broth',
    },
    kindLine: (meals, median, max) =>
      `in ${meals} meals · median ${median} kcal a serving · up to ${max}`,
    oilHeading: 'The oil nobody typed',
    oilBody: (f) =>
      `Kallo counted cooking oil in ${f.withOil} of the ${f.meals} meals. In ${f.unnamed} of them the person never mentioned oil, butter or frying: the dish is simply cooked that way, and the oil came to a median of ${f.oilKcal} kcal a meal. It is the part people most easily leave out when counting by hand.`,
    steadyHeading: 'The steadiest dishes',
    steadyLead:
      'Dishes with little variation between versions, where one number is a fair estimate.',
    methodHeading: 'How this was measured',
    method: (f) => [
      `Each dish has ${f.perDish} meals written to span how people commonly eat it: smaller and larger portions, with and without the usual extras, homemade and from a restaurant. They are not a random sample of what Kallo's users log, and no user's data is in them.`,
      `Every meal was typed into Kallo once, ${f.dates.from === f.dates.to ? `on ${f.dates.from}` : `between ${f.dates.from} and ${f.dates.to}`}, and run through the same pipeline the app uses: it splits the meal into ingredients, estimates the grams, and takes calories from food composition tables (USDA FoodData Central and others). Each dish's page shows its ${f.perDish} meals and every ingredient.`,
      'Ratios compare the heaviest and lightest meal of one dish; "median" is the middle value across dishes or ingredient servings.',
    ],
    citeHeading: 'Using these numbers',
    cite: (_f, url) =>
      `You are welcome to quote or chart these figures. Please credit "Kallo, meals logged in Kallo" and link to ${url}.`,
    tryLine:
      'Kallo counts your meals the same way, from a sentence like "half a burrito bowl, no rice, extra salsa".',
  },
  vi: {
    metaTitle: (f) =>
      `Cùng một món, chênh nhau ${f.ratio} lần calo: ${f.meals} bữa ăn thật`,
    description: (f) =>
      `Chúng tôi ghi ${f.dishes} món ăn Việt, mỗi món ${f.perDish} cách ăn phổ biến. Bản nhiều calo nhất của một món thường gấp ${f.ratio} lần bản ít nhất, và dầu mỡ ẩn trong ${f.unnamed} bữa.`,
    title: 'Cùng một món, calo chênh nhau bao nhiêu?',
    lead: (f) =>
      `Bảng calo thường chỉ cho một con số mỗi món. Chúng tôi ghi ${f.dishes} món ăn Việt vào Kallo, mỗi món ${f.perDish} cách ăn phổ biến, tổng cộng ${f.meals} bữa, từ tô nhỏ ở nhà đến tô đặc biệt ngoài quán, gõ đúng như người ta vẫn kể. Với một món điển hình, bản nhiều calo nhất gấp ${f.ratio} lần bản ít nhất. Chính khoảng chênh đó, chứ không phải con số trong bảng, quyết định một ngày ăn của bạn có đúng mục tiêu hay không.`,
    swingsHeading: 'Những món chênh nhiều nhất',
    swingsLead:
      'Những món có mức chênh lớn nhất giữa phần nhẹ nhất và nặng nhất, kèm khẩu phần cụ thể.',
    swingLine: (low, high) => `nhẹ nhất: ${low} · nặng nhất: ${high}`,
    kindsHeading: 'Thứ làm con số thay đổi',
    kindsLead:
      'Những thành phần có nhiều calo nhất mỗi phần và số bữa có các thành phần đó.',
    kinds: {
      rice: 'Cơm',
      bread: 'Bánh mì',
      noodles: 'Bún, phở, mì, hủ tiếu',
      broth: 'Nước dùng',
      oil: 'Dầu, mỡ',
      sugar: 'Đường, sữa đặc',
      sauce: 'Nước mắm, nước chấm',
      cheese: 'Phô mai',
      butter: 'Bơ',
    },
    kindLine: (meals, median, max) =>
      `có trong ${meals} bữa · trung bình ${median} kcal một phần · cao nhất ${max}`,
    oilHeading: 'Dầu mỡ không ai nhắc tới',
    oilBody: (f) =>
      `Kallo tính dầu hoặc mỡ trong ${f.withOil} trên ${f.meals} bữa. Trong ${f.unnamed} bữa, người ăn không hề nhắc đến dầu, mỡ hay chiên xào: món đó vốn được nấu như vậy, và phần dầu này trung bình ${f.oilKcal} kcal mỗi bữa. Đây là phần rất dễ bị bỏ sót khi tự đếm calo.`,
    steadyHeading: 'Những món ổn định nhất',
    steadyLead:
      'Những món ít chênh lệch giữa các cách ăn, có thể ước lượng bằng một con số.',
    methodHeading: 'Cách đo',
    method: (f) => [
      `Mỗi món có ${f.perDish} bữa mô tả các cách ăn phổ biến: phần nhỏ và lớn, có và không có đồ thêm, ở nhà và ngoài quán. Các bữa này không phải mẫu ngẫu nhiên từ người dùng Kallo và không chứa dữ liệu của người dùng.`,
      `Mỗi bữa được gõ vào Kallo một lần, ${f.dates.from === f.dates.to ? `ngày ${f.dates.from}` : `từ ngày ${f.dates.from} đến ngày ${f.dates.to}`}, qua cùng quy trình ứng dụng dùng: tách món thành nguyên liệu, ước lượng gram, lấy calo từ bảng thành phần thực phẩm (Viện Dinh dưỡng Quốc gia, USDA và các nguồn khác). Trang của từng món có ${f.perDish} bữa và từng nguyên liệu.`,
      'Tỷ lệ so sánh bữa nặng nhất và nhẹ nhất của cùng một món; "trung bình" ở đây là giá trị giữa (trung vị) qua các món hoặc các phần nguyên liệu.',
    ],
    citeHeading: 'Dùng lại số liệu',
    cite: (_f, url) =>
      `Bạn có thể trích dẫn hoặc vẽ biểu đồ từ các số liệu này. Vui lòng ghi nguồn "Kallo, các bữa ăn ghi trong Kallo" và dẫn link về ${url}.`,
    tryLine:
      'Kallo tính calo bữa ăn của bạn theo cùng cách đó, từ một câu như "1 tô phở bò tái, thêm 1 quẩy, ly trà đá".',
  },
};
