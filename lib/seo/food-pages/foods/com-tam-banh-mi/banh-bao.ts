import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'com-tam-banh-mi',
  meals: [
    {
      key: 'tho-phat',
      label: 'Thọ Phát nhân thịt trứng muối',
      text: '1 cái bánh bao Thọ Phát nhân thịt trứng muối',
    },
    {
      key: 'xa-xiu',
      label: 'Bánh bao xá xíu',
      text: '1 cái bánh bao xá xíu cỡ vừa',
    },
    {
      key: 'chay',
      label: 'Hai cái bánh bao chay',
      text: '2 cái bánh bao chay nhỏ, chấm nước tương',
    },
    {
      key: 'dac-biet',
      label: 'Bánh bao đặc biệt cỡ lớn',
      text: '1 cái bánh bao đặc biệt cỡ lớn nhân thịt, trứng cút, lạp xưởng, nấm mèo',
    },
  ],
  copy: {
    name: 'Bánh bao',
    title: 'Bánh bao bao nhiêu calo?',
    metaTitle: 'Bánh bao bao nhiêu calo? 4 loại bánh bao thật',
    description: (span) =>
      `Khoảng ${span} calo. Bốn phần bánh bao: Thọ Phát nhân thịt trứng muối, xá xíu, hai cái bánh bao chay và một cái đặc biệt cỡ lớn.`,
    lead: (span) =>
      `Từ khoảng ${span} calo. Vỏ bánh là phần nặng nhất, nên cỡ bánh quan trọng hơn loại nhân. Dưới đây là bốn lần ăn thật, mỗi lần gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'dac-biet',
    breakdownLead:
      'Ở cái bánh bao đặc biệt cỡ lớn, 150 g vỏ bánh là 333 calo; lạp xưởng thêm 88, thịt 78. Một cái bánh bao chay nhỏ, gần như chỉ có vỏ, khoảng 130 calo.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “1 cái bánh bao xá xíu, thêm hộp sữa đậu nành”, Kallo lo phần còn lại.',
  },
};
