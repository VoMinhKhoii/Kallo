import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'bun-cuon',
  meals: [
    {
      key: 'cha-lua',
      label: 'Một đĩa, thêm chả lụa và chả quế',
      text: 'Bánh cuốn nóng 1 đĩa, thêm 2 lát chả lụa, chấm nước mắm pha, có hành phi rau thơm, ăn thêm 1 miếng chả quế',
    },
    {
      key: 'hai-dia',
      label: 'Hai đĩa nhân thịt mộc nhĩ',
      text: '2 đĩa bánh cuốn nóng nhân thịt mộc nhĩ, thêm 1 miếng chả quế cắt khoanh, nước chấm, không lấy trứng',
    },
    {
      key: 'thanh-tri',
      label: 'Thanh Trì, không nhân',
      text: 'Bánh cuốn Thanh Trì 1 đĩa (không nhân) ăn với 2 miếng chả quế, nước chấm',
    },
    {
      key: 'trung',
      label: 'Bánh cuốn trứng',
      text: 'Bánh cuốn trứng 1 đĩa, nhân thịt, 1 quả trứng gà tráng trong bánh, chấm nước mắm, hành phi',
    },
  ],
  copy: {
    name: 'Bánh cuốn',
    title: 'Bánh cuốn bao nhiêu calo?',
    metaTitle: 'Bánh cuốn bao nhiêu calo? 4 đĩa bánh cuốn thật',
    description: (span) =>
      `Khoảng ${span} calo. Bốn đĩa bánh cuốn thật: thêm chả lụa và chả quế, hai đĩa nhân thịt mộc nhĩ, bánh cuốn Thanh Trì không nhân và bánh cuốn trứng.`,
    lead: (span) =>
      `Từ khoảng ${span} calo. Lớp bánh mỏng nhẹ hơn người ta nghĩ; chả ăn kèm mới quyết định một đĩa. Dưới đây là bốn đĩa thật, mỗi đĩa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'thanh-tri',
    breakdownLead:
      'Ở đĩa Thanh Trì không nhân, 200 g bánh chỉ 253 calo; hai miếng chả quế (100 g) là 339, nhiều hơn cả đĩa bánh. Nước chấm thêm khoảng 50 calo, phần lớn từ đường.',
    tryLine:
      'Gõ bữa của bạn như khi kể lại, kiểu “bánh cuốn 1 đĩa, thêm 2 lát chả, không hành phi”, Kallo lo phần còn lại.',
  },
};
