import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'nau-o-nha',
  meals: [
    {
      key: 'nam-mieng',
      label: 'Năm miếng có xương, canh bí đỏ',
      text: 'Gà rang gừng khoảng 5 miếng có xương, su su luộc chấm muối vừng, canh bí đỏ 1 bát, cơm 2 bát',
    },
    {
      key: 'com-rang',
      label: 'Hâm lại, ăn với cơm rang trứng',
      text: 'Gà rang gừng nửa đĩa hâm lại, 1 bát cơm nguội rang với 1 quả trứng và 1 thìa dầu',
    },
    {
      key: 'dui-bo-da',
      label: 'Đùi bỏ da, canh bí xanh',
      text: 'Gà rang gừng 4 miếng đùi bỏ da, canh bí xanh nấu tôm, rau cải xào tỏi 1 đĩa nhỏ, 2 bát cơm',
    },
    {
      key: 'uc-ga',
      label: 'Ức gà, 1 bát cơm, rau luộc',
      text: 'Gà rang gừng 3 miếng ức gà (khoảng 120g), 1 bát cơm, rau luộc',
    },
  ],
  copy: {
    name: 'Gà rang gừng',
    title: 'Gà rang gừng bao nhiêu calo?',
    metaTitle: 'Gà rang gừng bao nhiêu calo? 4 bữa cơm thật',
    description: (span) =>
      `Khoảng ${span} calo một bữa. Bốn bữa có gà rang gừng: năm miếng có xương với hai bát cơm, gà hâm lại với cơm rang trứng, đùi bỏ da và ức gà.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một bữa. Phần gà và số bát cơm quyết định gần hết; da, dầu rang và đường thêm vào sau. Dưới đây là bốn bữa thật, mỗi bữa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'nam-mieng',
    breakdownLead:
      'Trong bữa năm miếng gà có xương, gà là 362 calo và hai bát cơm 303; dầu rang thêm 72. Canh bí đỏ và su su luộc cộng lại chưa tới 100. Ba miếng ức gà (120 g) chỉ 162.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “gà rang gừng 4 miếng, bỏ da, 1 bát cơm”, Kallo lo phần còn lại.',
  },
};
