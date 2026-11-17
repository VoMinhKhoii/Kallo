import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mon-nuoc',
  meals: [
    {
      key: 'dac-biet',
      label: 'Tô đặc biệt, thêm trứng chần và 2 quẩy',
      text: 'Phở bò tái lăn tô đặc biệt, thêm 1 trứng chần và 2 cái quẩy. Ăn hết bánh với thịt, nước dùng húp khoảng nửa tô',
    },
    {
      key: 'to-nho',
      label: 'Tô nhỏ, ít bánh, không quẩy',
      text: 'Phở bò tái tô nhỏ, ít bánh, không hành, không quẩy, húp hết nước',
    },
    {
      key: 'chin-nam-gau',
      label: 'Tô lớn chín nạm gầu, thêm nước béo',
      text: 'Phở bò tô lớn chín nạm gầu, thêm 1 chén nước béo, ăn kèm giá và rau quế, cho 1 muỗng tương đen',
    },
    {
      key: 'nha-nau',
      label: 'Nấu ở nhà, thăn bò cân sẵn',
      text: 'Tự nấu phở ở nhà: 150g bánh phở tươi, 100g thăn bò sống thái mỏng chần nước dùng, 1 tô to nước dùng xương, hành ngò',
    },
  ],
  copy: {
    name: 'Phở bò',
    title: 'Phở bò bao nhiêu calo?',
    metaTitle: (span) => `Phở bò bao nhiêu calo? ${span} kcal, 4 tô phở thật`,
    description: (span) =>
      `Khoảng ${span} calo một tô. Bốn tô phở bò: tô đặc biệt thêm trứng và quẩy, tô nhỏ ít bánh, tô lớn chín nạm gầu thêm nước béo và một tô nấu ở nhà.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một tô. Bánh phở và thịt làm nên phần lớn con số; gầu, nước béo và quẩy là những thứ đẩy nó lên nhanh nhất. Dưới đây là bốn tô thật, mỗi tô gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'chin-nam-gau',
    breakdownLead:
      'Trong tô lớn chín nạm gầu, riêng 60 g gầu đã 272 calo, nhiều hơn 200 g bánh phở; chén nước béo thêm 101 calo nữa. Nước dùng thường chỉ vài chục calo, nên húp hết hay chừa lại không đổi bao nhiêu, trừ khi đó là nước béo.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “phở tái tô nhỏ, ít bánh, không quẩy”, Kallo lo phần còn lại.',
  },
};
