import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'bun-cuon',
  meals: [
    {
      key: 'mot-suat',
      label: 'Một suất bún đậu thịt luộc',
      text: 'Bún đậu mắm tôm 1 suất: bún lá, 4 miếng đậu rán, thịt luộc, rau kinh giới, chấm mắm tôm',
    },
    {
      key: 'day-du',
      label: 'Suất đầy đủ chả cốm, lòng dồi, nem chua rán',
      text: 'Bún đậu mắm tôm suất đầy đủ: bún lá, đậu rán, chả cốm, thịt chân giò luộc, lòng dồi, nem chua rán, mắm tôm',
    },
    {
      key: 'chi-dau',
      label: 'Suất nhỏ chỉ có bún và đậu',
      text: 'Bún đậu mắm tôm suất nhỏ chỉ có bún lá và 5 miếng đậu rán, chấm mắm tôm',
    },
    {
      key: 'khong-thit',
      label: 'Thêm chả cốm, không thịt',
      text: 'Bún đậu mắm tôm 1 suất có bún lá, đậu rán, thêm chả cốm, không lấy thịt, chấm mắm tôm vắt chanh',
    },
  ],
  copy: {
    name: 'Bún đậu mắm tôm',
    title: 'Bún đậu mắm tôm bao nhiêu calo?',
    metaTitle: 'Bún đậu mắm tôm bao nhiêu calo? 4 suất thật',
    description: (span) =>
      `Khoảng ${span} calo một suất. Bốn suất bún đậu mắm tôm: có thịt luộc, đủ chả cốm lòng dồi nem chua rán, suất nhỏ chỉ bún và đậu, thêm chả cốm không thịt.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một suất. Đậu rán là phần nặng nhất; thịt luộc, chả cốm và nem chua rán cộng thêm từng món. Dưới đây là bốn suất thật, mỗi suất gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'mot-suat',
    breakdownLead:
      'Trong một suất bún đậu có thịt luộc, bốn miếng đậu rán là 468 calo, gấp ba phần bún lá (158); thịt luộc thêm 229. Mắm tôm chấm cả suất chỉ khoảng 20 calo.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “bún đậu 1 suất, 3 miếng đậu, thêm chả cốm, không lòng”, Kallo lo phần còn lại.',
  },
};
