import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'com-tam-banh-mi',
  meals: [
    {
      key: 'op-la',
      label: 'Thịt nguội pate chả lụa, thêm ốp la',
      text: 'Ổ bánh mì thịt nguội pate chả lụa, thêm trứng ốp la, không dưa leo không ngò',
    },
    {
      key: 'thuong',
      label: 'Bánh mì thịt thường',
      text: '1 ổ bánh mì thịt thường: pate, bơ, thịt nguội, chả lụa, dưa leo, đồ chua, ngò',
    },
    {
      key: 'thit-nuong',
      label: 'Bánh mì thịt nướng',
      text: '1 ổ bánh mì thịt nướng, có đồ chua, dưa leo, ít nước sốt',
    },
    {
      key: 'heo-quay',
      label: 'Bánh mì heo quay',
      text: '1 ổ bánh mì heo quay da giòn, có dưa leo, đồ chua, nước sốt',
    },
  ],
  copy: {
    name: 'Bánh mì thịt',
    title: 'Bánh mì thịt bao nhiêu calo?',
    metaTitle: '1 ổ bánh mì thịt bao nhiêu calo? 4 ổ bánh mì thật',
    description: (span) =>
      `Khoảng ${span} calo một ổ. Bốn ổ bánh mì: thịt nguội pate chả lụa thêm ốp la, bánh mì thịt thường, bánh mì thịt nướng và bánh mì heo quay.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một ổ. Riêng ổ bánh mì đã khoảng 200; phần nhân quyết định phần còn lại. Dưới đây là bốn ổ thật, mỗi ổ gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'thit-nuong',
    breakdownLead:
      'Trong ổ bánh mì thịt nướng, 70 g thịt nướng là 280 calo, nhiều hơn cả ổ bánh (199). Ở ổ thịt thường, pate, bơ, thịt nguội và chả lụa cộng lại khoảng 250 calo.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “bánh mì thịt, ít pate, thêm trứng”, Kallo lo phần còn lại.',
  },
};
