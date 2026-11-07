import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'bun-cuon',
  meals: [
    {
      key: 'cha-gio',
      label: 'Thịt nướng chả giò, thêm chén nước mắm',
      text: 'Tô bún thịt nướng chả giò, xin thêm chén nước mắm, có đồ chua, đậu phộng, mỡ hành đầy đủ',
    },
    {
      key: 'to-thuong',
      label: 'Tô thường, không chả giò, ít mỡ hành',
      text: 'Bún thịt nướng tô thường, không chả giò, ít mỡ hành, nhiều rau',
    },
    {
      key: 'dac-biet',
      label: 'Tô đặc biệt, nem nướng và tôm',
      text: 'Bún thịt nướng tô đặc biệt: thịt nướng, 2 cuốn chả giò, nem nướng, tôm, mỡ hành, đậu phộng',
    },
    {
      key: 'them-thit',
      label: 'Ít bún, thêm thịt, không mỡ hành',
      text: 'Bún thịt nướng ít bún, xin thêm 1 phần thịt nướng, không mỡ hành, không đậu phộng',
    },
  ],
  copy: {
    name: 'Bún thịt nướng',
    title: 'Bún thịt nướng bao nhiêu calo?',
    metaTitle: 'Bún thịt nướng bao nhiêu calo? 4 tô bún thật',
    description: (span) =>
      `Khoảng ${span} calo. Bốn tô bún thịt nướng: thêm chả giò và chén nước mắm, tô thường không chả giò, tô đặc biệt có nem nướng, tô ít bún thêm thịt.`,
    lead: (span) =>
      `Từ khoảng ${span} calo. Bún chỉ chiếm một phần; thịt nướng và chả giò mới là thứ đẩy con số lên. Dưới đây là bốn tô thật, mỗi tô gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'them-thit',
    breakdownLead:
      'Ở tô ít bún nhưng thêm một phần thịt, 200 g thịt nướng là 801 calo, còn bún chỉ 127. Bớt bún chẳng giảm được bao nhiêu nếu phần thịt tăng gấp đôi.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “bún thịt nướng chả giò, ít bún, không đậu phộng”, Kallo lo phần còn lại.',
  },
};
