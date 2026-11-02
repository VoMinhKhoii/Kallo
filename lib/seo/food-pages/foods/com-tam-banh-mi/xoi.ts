import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'com-tam-banh-mi',
  meals: [
    {
      key: 'xeo',
      label: 'Xôi xéo, không lấy mỡ',
      text: 'Xôi xéo 1 gói, có hành phi với ruốc, không lấy mỡ',
    },
    {
      key: 'xeo-day-du',
      label: 'Xôi xéo thêm giò và trứng đúc',
      text: 'Gói xôi xéo thêm giò lụa và trứng đúc, nhiều hành phi mỡ gà',
    },
    {
      key: 'lac',
      label: 'Xôi lạc, gói nhỏ',
      text: '1 gói xôi lạc nhỏ, rắc muối vừng',
    },
    {
      key: 'dau-xanh',
      label: 'Xôi đậu xanh dừa nạo',
      text: '1 gói xôi đậu xanh có dừa nạo, rắc đường và mè',
    },
  ],
  copy: {
    name: 'Xôi',
    title: 'Xôi bao nhiêu calo?',
    metaTitle: '1 gói xôi bao nhiêu calo? 4 gói xôi thật',
    description: (span) =>
      `Khoảng ${span} calo một gói. Bốn gói xôi thật: xôi xéo không lấy mỡ, xôi xéo thêm giò lụa và trứng đúc, xôi lạc gói nhỏ và xôi đậu xanh dừa nạo.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một gói. Xôi nặng hơn cơm cùng lượng, nên cỡ gói quyết định nhiều nhất; mỡ gà, hành phi, trứng và giò cộng thêm sau. Dưới đây là bốn gói thật, mỗi gói gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'xeo-day-du',
    breakdownLead:
      'Trong gói xôi xéo đầy đủ, 200 g xôi là 508 calo; trứng đúc thêm 138, giò lụa 81, mỡ gà 72 và hành phi 43. Gói xôi lạc nhỏ (120 g xôi) là 380.',
    tryLine:
      'Gõ bữa của bạn như khi kể lại, kiểu “xôi xéo nửa gói, không mỡ, thêm ruốc”, Kallo lo phần còn lại.',
  },
};
