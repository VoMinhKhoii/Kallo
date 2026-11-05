import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'bun-cuon',
  meals: [
    {
      key: 'them-nem',
      label: 'Thêm 2 nem cua bể và 1 lượt bún',
      text: 'Bún chả 1 suất có cả chả miếng và chả viên, ăn thêm 2 cái nem cua bể, xin thêm 1 lượt bún',
    },
    {
      key: 'nua-bun',
      label: 'Nửa phần bún, không nem',
      text: 'Bún chả 1 suất nhưng chỉ ăn nửa phần bún tươi, ăn hết thịt nướng và chả viên, không gọi nem',
    },
    {
      key: 'suat-thuong',
      label: 'Một suất thường',
      text: 'Bún chả Hà Nội 1 suất: bún tươi, thịt ba chỉ nướng, chả băm viên, rau sống, nước chấm đu đủ cà rốt',
    },
    {
      key: 'nha-lam',
      label: 'Làm ở nhà, nạc vai cân sẵn',
      text: 'Bún chả tự làm ở nhà: 200g bún tươi, 100g thịt nạc vai nướng, 4 viên chả băm, rau sống, nước chấm',
    },
  ],
  copy: {
    name: 'Bún chả',
    title: 'Bún chả bao nhiêu calo?',
    metaTitle: 'Bún chả bao nhiêu calo? 4 suất bún chả thật',
    description: (span) =>
      `Khoảng ${span} calo một suất. Bốn suất bún chả: thêm nem cua bể và một lượt bún, chỉ ăn nửa phần bún, một suất thường và bún chả làm ở nhà.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một suất. Bún nhẹ hơn người ta nghĩ; thịt nướng, chả và nem gọi thêm mới quyết định con số. Dưới đây là bốn suất thật, mỗi suất gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'suat-thuong',
    breakdownLead:
      'Trong một suất bún chả thường, thịt ba chỉ nướng là 296 calo và chả viên 158, còn 150 g bún chỉ 168. Gọi thêm hai cái nem và một lượt bún là suất ăn vượt 1.000.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “bún chả 1 suất, ít bún, thêm 1 cái nem”, Kallo lo phần còn lại.',
  },
};
