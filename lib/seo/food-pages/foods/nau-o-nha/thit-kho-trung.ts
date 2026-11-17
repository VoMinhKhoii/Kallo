import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'nau-o-nha',
  meals: [
    {
      key: 'com-chieu',
      label: 'Cơm chiều, 2 miếng ba rọi và 1 trứng',
      text: 'Cơm chiều: 1 chén cơm, thịt kho trứng 2 miếng ba rọi và 1 trứng gà, 1 chén dưa giá',
    },
    {
      key: 'hot-vit',
      label: 'Hai hột vịt, chan nước kho',
      text: 'Thịt kho hột vịt: 2 hột vịt và 3 miếng thịt ba rọi có chan nước kho, dưa giá 1 chén nhỏ, cơm 1 chén',
    },
    {
      key: 'van-phong',
      label: 'Cơm văn phòng, thêm nửa chén cơm',
      text: 'Cơm văn phòng: cơm trắng, thịt kho trứng (1 trứng), canh bí đỏ, cải ngọt xào tỏi, xin thêm nửa chén cơm',
    },
    {
      key: 'nac-vai',
      label: 'Thịt nạc vai, rau luộc',
      text: 'Thịt kho trứng bằng thịt nạc vai: 4 miếng nạc và 1 trứng gà, 1 chén cơm, 1 dĩa rau luộc',
    },
  ],
  copy: {
    name: 'Thịt kho trứng',
    title: 'Thịt kho trứng bao nhiêu calo?',
    metaTitle: (span) =>
      `Thịt kho trứng bao nhiêu calo? ${span} kcal, 4 bữa cơm thật`,
    description: (span) =>
      `Khoảng ${span} calo một bữa. Bốn bữa có thịt kho trứng thật: hai miếng ba rọi với một chén cơm, thịt kho hột vịt chan nước kho, cơm văn phòng thêm cơm, và thịt nạc vai kho trứng.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một bữa. Miếng ba rọi là phần nặng nhất; trứng, cơm và nước kho cộng thêm sau. Dưới đây là bốn bữa thật, mỗi bữa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'hot-vit',
    breakdownLead:
      'Ở bữa thịt kho hột vịt, ba miếng ba rọi đã 641 calo, hơn cả hai hột vịt và chén cơm cộng lại; chan nước kho thêm 108. Đổi sang thịt nạc vai, bốn miếng chỉ 275.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “thịt kho trứng 2 miếng nạc, 1 trứng, 1 chén cơm”, Kallo lo phần còn lại.',
  },
};
