import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'do-uong',
  meals: [
    {
      key: 'duong-den',
      label: 'Đường đen size L, thêm pudding và thạch',
      text: 'Trà sữa trân châu đường đen size L, 50% đường, ít đá, thêm pudding trứng và thạch phô mai',
    },
    {
      key: 'size-m',
      label: 'Size M, 50% đường',
      text: 'Trà sữa trân châu size M, 50% đường, ít đá',
    },
    {
      key: 'khong-topping',
      label: 'Size M, không trân châu, 30% đường',
      text: 'Trà sữa size M không trân châu, 30% đường, 70% đá',
    },
    {
      key: 'full-topping',
      label: 'Full topping size L, 100% đường',
      text: '1 ly trà sữa full topping size L, 100% đường: trân châu đen, trân châu trắng, pudding, thạch',
    },
  ],
  copy: {
    name: 'Trà sữa trân châu',
    title: 'Trà sữa trân châu bao nhiêu calo?',
    metaTitle: (span) =>
      `1 ly trà sữa bao nhiêu calo? ${span} kcal, 4 ly trà sữa thật`,
    description: (span) =>
      `Khoảng ${span} calo một ly. Bốn ly trà sữa thật: đường đen size L thêm pudding và thạch, size M 50% đường, size M không trân châu, và full topping 100% đường.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một ly. Trà gần như không có calo; trân châu, đường và topping làm nên gần hết con số. Dưới đây là bốn ly thật, mỗi ly gõ vào Kallo đúng như người ta vẫn gọi.`,
    breakdownOf: 'full-topping',
    breakdownLead:
      'Trong ly full topping size L, hai loại trân châu là 483 calo, hơn nửa ly; sữa thêm 150 và đường 80. Bỏ trân châu và giảm đường, ly size M còn khoảng 130.',
    tryLine:
      'Gõ vào Kallo như khi gọi món: “trà sữa size M, 30% đường, thêm trân châu trắng”, Kallo lo phần còn lại.',
  },
};
