import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'nau-o-nha',
  meals: [
    {
      key: 'ca-loc',
      label: 'Cá lóc kho tộ, canh chua, 2 chén cơm',
      text: 'Cơm má nấu: cá lóc kho tộ 1 khúc, canh chua cá lóc có bạc hà, thơm, giá, cà chua, 2 chén cơm, rau sống chấm nước mắm',
    },
    {
      key: 'basa',
      label: 'Cá basa kho tộ, rau muống xào',
      text: 'Bữa tối nhà nấu: cá basa kho tộ 1 khúc, canh chua, rau muống xào tỏi, 1 chén rưỡi cơm',
    },
    {
      key: 'ca-bong',
      label: 'Cá bống kho tiêu, 2 chén cơm',
      text: 'Cá bống kho tiêu 5 con nhỏ, canh bí đao nấu tôm khô, dưa leo, 2 chén cơm',
    },
    {
      key: 'ca-nuc',
      label: 'Cá nục kho cà, chấm mắm nêm',
      text: 'Cơm trưa: 2 chén cơm, 2 con cá nục kho cà, rau lang luộc 1 dĩa nhỏ, chấm mắm nêm',
    },
  ],
  copy: {
    name: 'Cá kho tộ',
    title: 'Cá kho tộ bao nhiêu calo?',
    metaTitle: 'Cá kho tộ bao nhiêu calo? 4 bữa cơm nhà thật',
    description: (span) =>
      `Khoảng ${span} calo một bữa. Bốn bữa cơm nhà có cá kho thật: cá lóc kho tộ với canh chua, cá basa kho với rau muống xào, cá bống kho tiêu và cá nục kho cà.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một bữa. Bản thân khúc cá kho không nặng; chén cơm ăn kèm, dầu và đường trong nước kho mới làm nên phần lớn con số. Dưới đây là bốn bữa thật, mỗi bữa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'ca-nuc',
    breakdownLead:
      'Trong bữa cá nục kho cà, hai chén cơm là 303 calo, còn hai con cá chỉ 198. Ở bữa cơm nhà, cơm thường nặng hơn món kho: mỗi chén thêm là khoảng 150 calo.',
    tryLine:
      'Gõ bữa của bạn như khi kể lại, kiểu “cá kho tộ 1 khúc, canh chua, 1 chén rưỡi cơm”, Kallo lo phần còn lại.',
  },
};
