import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'nau-o-nha',
  meals: [
    {
      key: 'hai-trung',
      label: 'Một gói, 2 trứng, bỏ nửa gói dầu',
      text: '1 gói Hảo Hảo tôm chua cay, đập thêm 2 quả trứng, bỏ nửa gói dầu',
    },
    {
      key: 'hai-goi',
      label: 'Hai gói, ăn hết mì bỏ nước',
      text: 'Nấu 2 gói mì Hảo Hảo tôm chua cay (mỗi gói 75g), đập 1 trứng với nắm rau muống, ăn hết mì bỏ nước',
    },
    {
      key: 'xuc-xich',
      label: 'Một gói với xúc xích, bỏ gói dầu',
      text: '1 gói mì Hảo Hảo nấu với 2 cây xúc xích rán, bỏ gói dầu',
    },
    {
      key: 'mi-xao',
      label: 'Mì xào khô, thêm ốp la',
      text: '1 gói mì Indomie xào khô, trộn đủ gói dầu và gói sốt, thêm 1 quả trứng ốp la',
    },
  ],
  copy: {
    name: 'Mì gói',
    title: 'Mì gói bao nhiêu calo?',
    metaTitle: 'Mì gói bao nhiêu calo? 4 lần nấu mì thật',
    description: (span) =>
      `Khoảng ${span} calo. Bốn lần nấu mì gói thật: một gói Hảo Hảo đập hai trứng, hai gói với rau muống, một gói với xúc xích rán, và mì Indomie xào khô thêm ốp la.`,
    lead: (span) =>
      `Từ khoảng ${span} calo. Một vắt mì đã là phần lớn con số; thứ bạn thêm vào mới quyết định phần còn lại. Dưới đây là bốn lần nấu thật, mỗi lần gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'xuc-xich',
    breakdownLead:
      'Một vắt mì Hảo Hảo là 352 calo, kể cả khi bỏ gói dầu; hai cây xúc xích rán thêm 345 nữa. Trứng là thứ thêm vào nhẹ nhất: mỗi quả khoảng 70 calo.',
    tryLine:
      'Gõ vào Kallo như khi kể lại bữa ăn: “1 gói mì, 1 trứng, bỏ nửa gói dầu”, Kallo lo phần còn lại.',
  },
};
