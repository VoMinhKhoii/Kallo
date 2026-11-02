import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const deficit: ToolCopy = {
  name: 'Tính thâm hụt calo',
  blurb: 'Ăn bao nhiêu calo mỗi ngày để giảm cân, và bao lâu thì đạt.',
  metaTitle: 'Tính Thâm Hụt Calo: Ăn Bao Nhiêu Để Giảm Cân?',
  description:
    'Ăn bao nhiêu calo một ngày để giảm cân và khi nào đạt cân nặng mục tiêu. Cùng công thức và mức calo tối thiểu như app Kallo.',
  title: 'Tính thâm hụt calo',
  lead: 'Nhập số đo của bạn, cân nặng mục tiêu và tốc độ muốn giảm. Công cụ tính TDEE, trừ phần thâm hụt, rồi cho bạn số calo cần ăn mỗi ngày và ngày dự kiến đạt mục tiêu. Muốn tăng cân thì làm ngược lại.',
  sections: [
    {
      heading: 'Thâm hụt calo là gì?',
      paragraphs: [
        'Thâm hụt calo là ăn ít hơn lượng calo cơ thể đốt mỗi ngày (TDEE). Phần thiếu đó cơ thể lấy từ mỡ dự trữ. 1 kg mỡ chứa khoảng 7.700 kcal, nên muốn giảm 0,5 kg mỗi tuần bạn cần thâm hụt khoảng 550 kcal mỗi ngày; giảm 0,25 kg mỗi tuần thì khoảng 275 kcal.',
        'Kallo không bao giờ đặt mục tiêu dưới 1.200 kcal với nữ và 1.500 kcal với nam, mức tối thiểu thường dùng khi tự ăn kiêng không có chuyên gia theo dõi. Nếu tốc độ bạn chọn kéo xuống dưới mức này, công cụ giữ bạn ở mức tối thiểu và cho biết tốc độ giảm thật sự.',
      ],
    },
    {
      heading: 'Ví dụ cụ thể',
      paragraphs: [
        'Bạn nam 28 tuổi, 170 cm, 68 kg, tập 4 buổi mỗi tuần có TDEE khoảng 2.492 kcal. Muốn về 63 kg với tốc độ 0,5 kg mỗi tuần: 2.492 − 550 = 1.942 kcal mỗi ngày, mất khoảng 10 tuần.',
        'Bạn nữ 25 tuổi, 158 cm, 55 kg, làm văn phòng có TDEE khoảng 1.502 kcal. Cùng tốc độ 0,5 kg mỗi tuần thì phải ăn 952 kcal, quá thấp. Công cụ giữ ở 1.200 kcal, tương đương giảm khoảng 0,27 kg mỗi tuần. Chậm hơn, nhưng là mức ăn được lâu dài mà không đói lả. Đây là lý do nhiều bạn nữ nhỏ người ăn 1.000 kcal vẫn thấy mệt mà cân không xuống đều.',
      ],
    },
    {
      heading: 'Vì sao ngày đạt mục tiêu chỉ là ước tính',
      paragraphs: [
        'Quy tắc 7.700 kcal là một đường thẳng, còn cơ thể thì không. Khi bạn nhẹ đi, TDEE cũng giảm theo, nên cùng một mức ăn sẽ thâm hụt ít hơn; những tuần đầu còn mất nhiều nước nên cân xuống nhanh. Mô hình của Kevin Hall trên tạp chí The Lancet năm 2011 cho thấy quy tắc đơn giản này luôn ước lượng dư mức giảm khi kéo dài nhiều tháng. Cứ giảm được vài ký thì tính lại, và đánh giá theo cân nặng trung bình 2–3 tuần chứ đừng nhìn từng ngày.',
      ],
    },
    {
      heading: 'Nên giảm nhanh cỡ nào?',
      paragraphs: [
        'Khoảng 0,25–0,5 kg mỗi tuần là mức đa số người duy trì được mà vẫn giữ cơ và không phải bỏ hết các bữa ăn với gia đình, bạn bè. Giảm nhanh hơn thì đói hơn, dễ mất cơ và dễ tăng lại. Khi ăn thâm hụt, ăn đủ đạm còn quan trọng hơn bình thường (xem công cụ tính protein).',
      ],
    },
    {
      heading: 'Để ăn đúng con số',
      paragraphs: [
        'Mục tiêu chỉ có ý nghĩa khi bạn ghi chép thật. Khoảng cách giữa "mình ăn có 1.200 thôi" và cân không xuống thường nằm ở những thứ khó thấy: dầu xào, nước chấm, chén cơm thứ hai, ly cà phê sữa hay trà sữa. Ghi lại đúng những gì bạn ăn, bằng lời của bạn, là việc Kallo làm.',
      ],
    },
  ],
  sources: [SOURCES.mifflin, SOURCES.hall],
};
