import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mon-nuoc',
  meals: [
    {
      key: 'dac-biet',
      label: 'Tô đặc biệt giò heo, chả cua, thêm huyết',
      text: 'Tô bún bò Huế đặc biệt có giò heo, chả cua, bắp bò, thêm huyết. Ăn kèm rau sống bắp chuối, cho 1 muỗng sa tế',
    },
    {
      key: 'to-thuong',
      label: 'Tô thường, chỉ bắp bò',
      text: 'Bún bò Huế tô thường chỉ có bắp bò, ăn hết bún với thịt, húp nửa nước',
    },
    {
      key: 'them-gio',
      label: 'Tô thường, thêm 1 khúc giò heo',
      text: 'Bún bò Huế tô thường có bắp bò, thêm 1 khúc giò heo, không huyết, húp hết nước',
    },
    {
      key: 'nha-nau',
      label: 'Mẹ nấu, tô vừa',
      text: 'Bún bò Huế mẹ nấu, 1 tô vừa: 150g bún, 3 lát bắp bò, 1 miếng chả lụa, nước dùng sả ruốc, rau thơm',
    },
  ],
  copy: {
    name: 'Bún bò Huế',
    title: 'Bún bò Huế bao nhiêu calo?',
    metaTitle: '1 tô bún bò Huế bao nhiêu calo? 4 tô thật',
    description: (span) =>
      `Khoảng ${span} calo một tô. Bốn tô bún bò Huế thật: tô đặc biệt giò heo chả cua thêm huyết, tô thường chỉ bắp bò, tô thường thêm một khúc giò và một tô mẹ nấu ở nhà.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một tô. Bún và bắp bò là nền; khúc giò heo và chả cua là thứ làm con số tăng gần gấp đôi. Dưới đây là bốn tô thật, mỗi tô gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'them-gio',
    breakdownLead:
      'Một khúc giò heo (93 g) là 226 calo, ngang cả phần bún (221). Tô thường chỉ có bắp bò là 317; thêm giò là gần gấp đôi. Húp hết 450 g nước dùng chỉ thêm 62.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “bún bò Huế tô thường, không giò, ít bún”, Kallo lo phần còn lại.',
  },
};
