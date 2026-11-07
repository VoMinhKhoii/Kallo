import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mon-nuoc',
  meals: [
    {
      key: 'day-du',
      label: 'Bát đầy đủ, thêm 2 quẩy',
      text: 'Cháo lòng 1 bát đầy đủ (lòng, dồi, tim, gan, huyết), thêm 2 cái quẩy',
    },
    {
      key: 'dia-doi',
      label: 'Bát cháo và đĩa dồi lòng chấm mắm tôm',
      text: 'Cháo lòng 1 bát, gọi thêm 1 đĩa nhỏ dồi và lòng luộc chấm mắm tôm',
    },
    {
      key: 'to-nho',
      label: 'Tô nhỏ, chỉ huyết và gan',
      text: 'Cháo lòng tô nhỏ chỉ có huyết và gan, không quẩy',
    },
    {
      key: 'sai-gon',
      label: 'Tô lớn Sài Gòn, thêm giò cháo quẩy',
      text: 'Cháo lòng tô lớn kiểu Sài Gòn, có lòng non, gan, huyết, thêm 1 cái giò cháo quẩy',
    },
  ],
  copy: {
    name: 'Cháo lòng',
    title: 'Cháo lòng bao nhiêu calo?',
    metaTitle: 'Cháo lòng bao nhiêu calo? 4 bát cháo thật',
    description: (span) =>
      `Khoảng ${span} calo. Bốn bát cháo lòng: bát đầy đủ thêm quẩy, bát cháo kèm đĩa dồi lòng, tô nhỏ chỉ huyết và gan, tô lớn kiểu Sài Gòn.`,
    lead: (span) =>
      `Từ khoảng ${span} calo. Bát cháo khá nhẹ; quẩy và đĩa lòng dồi gọi thêm mới làm con số tăng gấp ba. Dưới đây là bốn bát thật, mỗi bát gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'day-du',
    breakdownLead:
      'Trong bát cháo lòng đầy đủ, hai cái quẩy đã là 351 calo, nhiều hơn cả bát cháo cùng lòng, dồi, tim, gan cộng lại (302). Bỏ quẩy, một tô nhỏ chỉ huyết và gan là khoảng 200 calo.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “cháo lòng bát vừa, thêm 1 cái quẩy, không dồi”, Kallo lo phần còn lại.',
  },
};
