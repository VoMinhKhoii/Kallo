import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'nau-o-nha',
  meals: [
    {
      key: 'mot-bia',
      label: 'Một bìa đậu rán sốt cà chua, 2 bát cơm',
      text: 'Đậu phụ rán sốt cà chua 1 bìa, canh cải nấu thịt băm 1 bát, 2 bát cơm',
    },
    {
      key: 'com-bui',
      label: 'Cơm bụi 25k, thêm 1 vá cơm',
      text: 'Cơm bụi 25k: cơm, đậu sốt cà chua, trứng chiên, ít rau muống luộc, xin thêm 1 vá cơm',
    },
    {
      key: 'nhoi-thit',
      label: 'Đậu nhồi thịt sốt cà chua',
      text: 'Đậu phụ nhồi thịt sốt cà chua 3 miếng, canh cải nấu tôm khô, đỗ quả xào tỏi, 1 bát rưỡi cơm',
    },
    {
      key: 'dau-non',
      label: 'Đậu non không chiên, rau lang luộc',
      text: 'Đậu hũ non sốt cà chua 1 dĩa nhỏ (không chiên), 1 chén cơm, rau lang luộc chấm tương',
    },
  ],
  copy: {
    name: 'Đậu phụ sốt cà chua',
    title: 'Đậu phụ sốt cà chua bao nhiêu calo?',
    metaTitle: 'Đậu phụ sốt cà chua bao nhiêu calo? 4 bữa thật',
    description: (span) =>
      `Khoảng ${span} calo một bữa. Bốn bữa có đậu sốt cà chua thật: một bìa đậu rán với hai bát cơm, cơm bụi thêm vá cơm, đậu nhồi thịt và đậu hũ non không chiên.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một bữa. Đậu rán hay không rán thay đổi nhiều hơn phần sốt; thịt nhồi và cơm làm nên phần còn lại. Dưới đây là bốn bữa thật, mỗi bữa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'mot-bia',
    breakdownLead:
      'Một bìa đậu phụ rán (120 g) là 351 calo, gần bằng hai bát cơm (303). Đậu hũ non không chiên, 150 g chỉ 101; phần sốt cà chua chỉ vài chục calo.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “đậu sốt cà chua 3 miếng, 1 bát cơm, canh rau”, Kallo lo phần còn lại.',
  },
};
