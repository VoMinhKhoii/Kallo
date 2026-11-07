import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'do-uong',
  meals: [
    {
      key: 'quan-coc',
      label: 'Quán cóc, ly nhỏ, nhiều sữa đặc',
      text: 'Ly cà phê sữa đá quán cóc, ly nhỏ, sữa đặc nhiều',
    },
    {
      key: 'nha-pha',
      label: 'Nhà pha, 3 muỗng sữa đặc',
      text: 'Cà phê sữa đá nhà pha, 1 phin, 3 muỗng sữa đặc Ông Thọ',
    },
    {
      key: 'highlands',
      label: 'Phin sữa đá Highlands size M',
      text: '1 ly phin sữa đá Highlands size M',
    },
    {
      key: 'ly-lon',
      label: 'Ly lớn, 3 muỗng sữa đặc',
      text: 'Cà phê sữa đá ly lớn ở quán, 3 muỗng sữa đặc, nhiều đá',
    },
  ],
  copy: {
    name: 'Cà phê sữa đá',
    title: 'Cà phê sữa đá bao nhiêu calo?',
    metaTitle: '1 ly cà phê sữa đá bao nhiêu calo? 4 ly thật',
    description: (span) =>
      `Khoảng ${span} calo một ly. Bốn ly cà phê sữa đá: ly nhỏ quán cóc nhiều sữa, nhà pha ba muỗng sữa đặc, phin sữa đá Highlands size M và ly lớn ở quán.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một ly. Cà phê và đá gần như không có calo; sữa đặc mới quyết định con số. Dưới đây là bốn ly thật, mỗi ly gõ vào Kallo đúng như người ta vẫn gọi.`,
    breakdownOf: 'ly-lon',
    breakdownLead:
      'Ở ly lớn, ba muỗng sữa đặc (45 g) là 151 calo, còn cà phê chỉ 2. Ly to hay nhỏ không quan trọng bằng bao nhiêu muỗng sữa.',
    tryLine:
      'Gõ vào Kallo như khi gọi món: “cà phê sữa đá, ít sữa, ly nhỏ”, Kallo lo phần còn lại.',
  },
};
