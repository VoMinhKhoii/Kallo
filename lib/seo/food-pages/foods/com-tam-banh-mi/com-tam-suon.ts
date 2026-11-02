import type { FoodContent } from '../../types';

export const food: FoodContent = {
  group: 'com-tam-banh-mi',
  meals: [
    {
      key: 'suon-bi-cha',
      label: 'Sườn bì chả trứng, thêm mỡ hành và cơm',
      text: 'Dĩa cơm tấm sườn bì chả trứng ốp la, xin thêm mỡ hành và nước mắm, ăn thêm nửa chén cơm',
    },
    {
      key: 'chi-suon',
      label: 'Chỉ sườn nướng, ít mỡ hành',
      text: 'Cơm tấm sườn nướng, chỉ có sườn, ít mỡ hành, chan 2 muỗng nước mắm, dưa leo cà chua',
    },
    {
      key: 'hai-suon',
      label: 'Hai miếng sườn, đủ bì chả trứng',
      text: 'Dĩa cơm tấm 2 miếng sườn nướng, 1 trứng ốp la, chả trứng, bì, mỡ hành, kèm chén canh',
    },
    {
      key: 'nua-com',
      label: 'Nửa cơm nửa dưa leo, không mỡ hành',
      text: 'Dĩa cơm tấm sườn, đổi nửa cơm nửa dưa leo cà chua, không mỡ hành, chan 2 muỗng nước mắm',
    },
  ],
  copy: {
    name: 'Cơm tấm sườn',
    title: 'Cơm tấm sườn bao nhiêu calo?',
    metaTitle: 'Cơm tấm sườn bao nhiêu calo? 4 dĩa cơm tấm thật',
    description: (span) =>
      `Khoảng ${span} calo. Bốn dĩa cơm tấm thật: sườn bì chả trứng thêm cơm, chỉ sườn nướng, hai miếng sườn đủ món kèm canh, và nửa cơm nửa dưa leo.`,
    lead: (span) =>
      `Từ khoảng ${span} calo một dĩa. Sườn và cơm là nền; bì, chả, trứng ốp la và miếng sườn thứ hai là những thứ nhân đôi con số. Dưới đây là bốn dĩa thật, mỗi dĩa gõ vào Kallo đúng như người ta vẫn kể.`,
    breakdownOf: 'hai-suon',
    breakdownLead:
      'Ở dĩa hai miếng sườn đủ bì chả trứng, riêng sườn đã 351 calo và cơm 227; trứng ốp la, chả trứng và bì cộng thêm khoảng 400 nữa. Một dĩa chỉ có sườn và cơm là 550.',
    tryLine:
      'Gõ bữa của bạn như khi kể lại, kiểu “cơm tấm sườn trứng, ít cơm, không mỡ hành”, Kallo lo phần còn lại.',
  },
};
