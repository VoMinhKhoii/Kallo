import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'bun-cuon',
  meals: [
    {
      key: 'chay',
      label: 'Bánh xèo chay, chấm nước tương',
      text: '1 cái bánh xèo chay nhân nấm, đậu hũ, giá, cuốn rau sống, chấm nước tương',
    },
    {
      key: 'mot-cai',
      label: 'Một cái tôm thịt',
      text: '1 cái bánh xèo tôm thịt cỡ lớn, cuốn rau sống, chấm nước mắm chua ngọt',
    },
    {
      key: 'mien-trung',
      label: 'Miền Trung, 6 cái nhỏ',
      text: 'Bánh xèo miền Trung 6 cái nhỏ nhân tôm thịt, cuốn bánh tráng với rau sống, chấm nước chấm tương đậu phộng',
    },
    {
      key: 'nha-do',
      label: 'Tự đổ ở nhà, chảo chống dính',
      text: 'Bánh xèo tự đổ ở nhà, 2 cái nhỏ, chảo chống dính dùng 1 muỗng canh dầu, nhân tôm và giá',
    },
  ],
  copy: {
    name: 'Bánh xèo',
    title: 'Bánh xèo bao nhiêu calo?',
    metaTitle: (span) =>
      `Bánh xèo bao nhiêu calo? ${span} kcal, 4 lần ăn bánh xèo thật`,
    description: (span) =>
      `Khoảng ${span} calo. Bốn lần ăn bánh xèo thật: một cái bánh xèo chay, một cái tôm thịt cỡ lớn, sáu cái nhỏ miền Trung và bánh tự đổ ở nhà bằng chảo chống dính.`,
    lead: (span) =>
      `Từ khoảng ${span} calo. Bột gạo là nền; nước cốt dừa, dầu đổ bánh và đường trong nước chấm làm nên phần còn lại. Dưới đây là bốn lần ăn thật, mỗi lần gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'mot-cai',
    breakdownLead:
      'Trong một cái bánh xèo tôm thịt cỡ lớn, bột gạo là 216 calo, nước cốt dừa 98 và dầu đổ bánh 90. Nước mắm chua ngọt thêm khoảng 50, phần lớn từ đường; rau sống cuốn kèm gần như không đáng kể.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “2 cái bánh xèo nhỏ, ít dầu, cuốn nhiều rau”, Kallo lo phần còn lại.',
  },
};
