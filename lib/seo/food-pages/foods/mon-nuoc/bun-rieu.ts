import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mon-nuoc',
  meals: [
    {
      key: 'day-du',
      label: 'Đầy đủ riêu, ốc, đậu, bắp bò',
      text: 'Bún riêu cua 1 bát đầy đủ: riêu cua, ốc, đậu phụ rán, bắp bò, thêm 1 thìa mắm tôm và ít ớt',
    },
    {
      key: 'to-nho',
      label: 'Tô nhỏ, chỉ riêu và cà chua',
      text: 'Bún riêu cua tô nhỏ, chỉ có riêu cua và cà chua, ăn hết bún, húp nửa nước',
    },
    {
      key: 'gio-heo',
      label: 'Tô lớn Sài Gòn, thêm giò heo',
      text: 'Bún riêu tô lớn kiểu Sài Gòn: riêu cua, huyết, chả lụa, 1 khúc giò heo, ăn với rau muống bào và giá',
    },
    {
      key: 'dac-biet',
      label: 'Tô đặc biệt, thêm chả và mỡ nước',
      text: 'Bún riêu cua tô đặc biệt: riêu cua, đậu phụ rán, chả lụa, bắp bò, thêm 1 thìa mỡ nước, húp hết nước',
    },
  ],
  copy: {
    name: 'Bún riêu',
    title: 'Bún riêu bao nhiêu calo?',
    metaTitle: (span) =>
      `1 tô bún riêu bao nhiêu calo? ${span} kcal, 4 tô bún riêu thật`,
    description: (span) =>
      `Khoảng ${span} calo một tô. Bốn tô bún riêu thật: bát đầy đủ riêu ốc đậu bắp bò, tô nhỏ chỉ riêu và cà chua, tô lớn kiểu Sài Gòn thêm giò heo, và tô đặc biệt thêm mỡ nước.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một tô. Riêu cua tự nó nhẹ; đậu phụ rán, giò heo, bắp bò và mỡ nước là những thứ làm con số tăng gấp bốn. Dưới đây là bốn tô thật, mỗi tô gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'dac-biet',
    breakdownLead:
      'Ở tô đặc biệt, riêu cua chỉ 57 calo; đậu phụ rán (204), bắp bò (187) và một thìa mỡ nước (121) mới là phần nặng. Tô nhỏ chỉ có riêu và cà chua là 223.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “bún riêu tô nhỏ, thêm đậu, không mỡ nước”, Kallo lo phần còn lại.',
  },
};
