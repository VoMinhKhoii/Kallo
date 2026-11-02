import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'nau-o-nha',
  meals: [
    {
      key: 'duong-chau',
      label: 'Dương Châu ở quán',
      text: '1 dĩa cơm chiên Dương Châu ở quán (lạp xưởng, tôm, trứng, đậu Hà Lan, cà rốt)',
    },
    {
      key: 'com-rang-trung',
      label: 'Cơm rang trứng ở nhà',
      text: 'Cơm rang ở nhà: 1 bát cơm nguội với 1 quả trứng, rắc ít ruốc, không hành',
    },
    {
      key: 'hai-san',
      label: 'Hải sản dĩa lớn, kèm canh',
      text: 'Cơm chiên hải sản dĩa lớn (tôm, mực, trứng), ăn kèm dưa leo và 1 chén canh',
    },
    {
      key: 'ga-xoi-mo',
      label: 'Cơm chiên gà xối mỡ',
      text: '1 dĩa cơm chiên gà xối mỡ, 1 cái đùi gà, dưa leo, nước mắm',
    },
  ],
  copy: {
    name: 'Cơm chiên',
    title: 'Cơm chiên bao nhiêu calo?',
    metaTitle: 'Cơm chiên bao nhiêu calo? 4 dĩa cơm chiên thật',
    description: (span) =>
      `Khoảng ${span} calo một dĩa. Bốn dĩa cơm chiên thật: Dương Châu ở quán, cơm rang trứng ở nhà, cơm chiên hải sản dĩa lớn và cơm chiên gà xối mỡ.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một dĩa. Cơm và dầu là nền; lạp xưởng và cái đùi gà chiên là thứ đẩy con số lên. Dưới đây là bốn dĩa thật, mỗi dĩa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'duong-chau',
    breakdownLead:
      'Trong dĩa cơm chiên Dương Châu, riêng 19 g lạp xưởng đã 112 calo, hơn nửa phần cơm (190); dầu chiên thêm 45. Tôm, đậu Hà Lan và cà rốt cộng lại chỉ khoảng 50.',
    tryLine:
      'Gõ bữa của bạn như khi kể lại, kiểu “cơm rang 1 bát, 2 trứng, ít dầu”, Kallo lo phần còn lại.',
  },
};
