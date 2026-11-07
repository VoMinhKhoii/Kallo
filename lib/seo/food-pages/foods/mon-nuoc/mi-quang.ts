import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mon-nuoc',
  meals: [
    {
      key: 'ga-ta',
      label: 'Gà ta, thêm bánh tráng mè và trứng cút',
      text: 'Tô mì Quảng gà ta, bẻ 1 cái bánh tráng mè vô, thêm 1 trứng cút, ít rau sống',
    },
    {
      key: 'tom-thit',
      label: 'Tôm thịt tô thường',
      text: 'Mì Quảng tôm thịt tô thường, có trứng cút, đậu phộng rang, bánh tráng mè, rau sống',
    },
    {
      key: 'dac-biet',
      label: 'Tô đặc biệt, thêm mỡ hành',
      text: 'Mì Quảng tô đặc biệt tôm, thịt, gà, 2 trứng cút, thêm 1 muỗng mỡ hành, ăn với 1 cái bánh tráng mè',
    },
    {
      key: 'ca-loc',
      label: 'Cá lóc tô nhỏ, không bánh tráng',
      text: 'Mì Quảng cá lóc tô nhỏ, ít mì, nhiều rau sống, không bánh tráng',
    },
  ],
  copy: {
    name: 'Mì Quảng',
    title: 'Mì Quảng bao nhiêu calo?',
    metaTitle: 'Mì Quảng bao nhiêu calo? 4 tô mì Quảng thật',
    description: (span) =>
      `Khoảng ${span} calo. Bốn tô mì Quảng: gà ta thêm bánh tráng mè, tôm thịt tô thường, tô đặc biệt thêm mỡ hành và tô cá lóc nhỏ.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một tô. Mì và thịt là phần chính; bánh tráng mè bẻ vào tô nặng hơn vẻ ngoài. Dưới đây là bốn tô thật, mỗi tô gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'tom-thit',
    breakdownLead:
      'Trong tô mì Quảng tôm thịt, mì và thịt heo chiếm hơn một nửa trong 468 calo; đậu phộng rang thêm 51. Ở tô gà ta, cả cái bánh tráng mè bẻ vào là 174 calo, hơn một chén cơm.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “mì Quảng gà, ít mì, không bánh tráng”, Kallo lo phần còn lại.',
  },
};
