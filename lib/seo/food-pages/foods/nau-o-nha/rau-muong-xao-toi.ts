import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'nau-o-nha',
  meals: [
    {
      key: 'trung-chien',
      label: 'Một dĩa nhỏ, trứng chiên, 1 chén cơm',
      text: 'Rau muống xào tỏi 1 dĩa nhỏ ăn với 1 chén cơm và 1 quả trứng chiên',
    },
    {
      key: 'com-nha',
      label: 'Bữa cơm nhà, cá thu kho',
      text: 'Cơm nhà mẹ nấu: 2 bát cơm, 1 khúc cá thu kho, rau muống xào tỏi, canh bí nấu tôm',
    },
    {
      key: 'xao-bo',
      label: 'Rau muống xào bò',
      text: 'Rau muống xào bò 1 đĩa (100g thịt bò), 1 bát cơm',
    },
    {
      key: 'nhieu-dau',
      label: 'Đĩa lớn xào nhiều dầu',
      text: '1 đĩa lớn rau muống xào tỏi nhiều dầu ăn một mình, 1 bát cơm',
    },
  ],
  copy: {
    name: 'Rau muống xào tỏi',
    title: 'Rau muống xào tỏi bao nhiêu calo?',
    metaTitle: 'Rau muống xào tỏi bao nhiêu calo? 4 bữa thật',
    description: (span) =>
      `Khoảng ${span} calo một bữa. Bốn bữa có rau muống thật: một dĩa nhỏ với trứng chiên, bữa cơm nhà có cá thu kho, rau muống xào bò, và một đĩa lớn xào nhiều dầu.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một bữa. Rau muống gần như không có calo; dầu xào, thịt xào cùng và chén cơm mới là con số. Dưới đây là bốn bữa thật, mỗi bữa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'nhieu-dau',
    breakdownLead:
      'Ở đĩa lớn xào nhiều dầu, 225 g rau muống chỉ 64 calo, còn 12 g dầu là 103. Ăn bao nhiêu rau cũng không đổi bao nhiêu; dầu và chén cơm (152) mới quyết định.',
    tryLine:
      'Gõ bữa của bạn như khi kể lại, kiểu “rau muống xào tỏi ít dầu, 1 chén cơm, 1 quả trứng luộc”, Kallo lo phần còn lại.',
  },
};
