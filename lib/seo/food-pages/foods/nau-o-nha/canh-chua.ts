import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'nau-o-nha',
  meals: [
    {
      key: 'ca-loc',
      label: 'Canh chua cá lóc, 1 chén cơm',
      text: 'Canh chua cá lóc 1 tô (2 khúc cá, thơm, cà chua, giá, bạc hà, đậu bắp), 1 chén cơm',
    },
    {
      key: 'tom-trung',
      label: 'Canh chua tôm, trứng chiên',
      text: 'Canh chua tôm 1 tô, 1 quả trứng chiên, 1 chén cơm',
    },
    {
      key: 'bong-dien-dien',
      label: 'Canh chua bông điên điển, cá rô kho',
      text: 'Cơm trưa: canh chua bông điên điển, cá rô kho tộ 2 con nhỏ, rau đắng chấm mắm kho, 2 chén cơm',
    },
    {
      key: 'chi-canh',
      label: 'Chỉ ăn canh, không cơm',
      text: '2 chén canh chua cá basa, không ăn cơm',
    },
  ],
  copy: {
    name: 'Canh chua',
    title: 'Canh chua bao nhiêu calo?',
    metaTitle: 'Canh chua bao nhiêu calo? 4 bữa có canh chua thật',
    description: (span) =>
      `Khoảng ${span} calo. Bốn bữa có canh chua thật: canh chua cá lóc với một chén cơm, canh chua tôm và trứng chiên, canh chua bông điên điển với cá rô kho, và chỉ ăn canh.`,
    lead: (span) =>
      `Từ khoảng ${span} calo. Một tô canh chua rất nhẹ; con số lên xuống theo cơm và món mặn ăn kèm. Dưới đây là bốn bữa thật, mỗi bữa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'ca-loc',
    breakdownLead:
      'Một tô canh chua cá lóc chỉ khoảng 160 calo: cá 76, phần còn lại là rau, thơm và chút đường. Chén cơm ăn kèm đã 152; bữa có thêm cá rô kho và hai chén cơm lên tới 766.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “canh chua cá lóc 1 tô, 1 chén cơm, ít cá kho”, Kallo lo phần còn lại.',
  },
};
