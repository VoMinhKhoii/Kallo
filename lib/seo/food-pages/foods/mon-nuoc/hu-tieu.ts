import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'mon-nuoc',
  meals: [
    {
      key: 'nam-vang-kho',
      label: 'Nam Vang khô tô lớn, tôm gan cật',
      text: 'Hủ tiếu Nam Vang khô tô lớn, có tôm, gan, cật, thịt bằm, trứng cút, trộn dầu tỏi và nước tương',
    },
    {
      key: 'go',
      label: 'Hủ tiếu gõ, nửa hủ tiếu nửa mì',
      text: 'Hủ tiếu gõ 1 tô nước, nửa hủ tiếu nửa mì, mấy lát xá xíu, 3 viên bò viên, hẹ, giá',
    },
    {
      key: 'nuoc-thuong',
      label: 'Nam Vang nước tô thường, húp nửa nước',
      text: 'Hủ tiếu Nam Vang nước tô thường, thịt bằm, 2 con tôm, giá hẹ, ăn hết bánh, húp nửa nước',
    },
    {
      key: 'xao-nha',
      label: 'Tự xào bò ở nhà, hủ tiếu cân khô',
      text: 'Tự nấu hủ tiếu xào bò: 120g hủ tiếu khô (cân trước khi trụng), 100g thịt bò sống ướp tỏi, 1 nắm cải ngọt, đập 1 quả trứng đảo chung, 1 muỗng canh dầu ăn',
    },
  ],
  copy: {
    name: 'Hủ tiếu',
    title: 'Hủ tiếu bao nhiêu calo?',
    metaTitle: '1 tô hủ tiếu bao nhiêu calo? 4 tô hủ tiếu thật',
    description: (span) =>
      `Khoảng ${span} calo một tô. Bốn tô hủ tiếu thật: Nam Vang khô tô lớn, hủ tiếu gõ nửa hủ tiếu nửa mì, Nam Vang nước tô thường và hủ tiếu xào bò tự nấu.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một tô. Sợi hủ tiếu là phần lớn nhất; thịt bằm, bò viên, xá xíu và dầu tỏi làm nên phần còn lại. Dưới đây là bốn tô thật, mỗi tô gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'xao-nha',
    breakdownLead:
      'Ở dĩa hủ tiếu xào tự nấu, 120 g hủ tiếu cân khô là 420 calo, nhiều hơn thịt bò (187) và một muỗng canh dầu (90) cộng lại. Sợi khô nở ra khoảng gấp ba khi trụng, nên cân khô hay cân chín cho con số khác hẳn.',
    tryLine:
      'Gõ bữa của bạn như khi kể lại, kiểu “hủ tiếu nam vang nước tô nhỏ, không gan, húp nửa nước”, Kallo lo phần còn lại.',
  },
};
