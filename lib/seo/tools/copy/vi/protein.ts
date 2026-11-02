import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const protein: ToolCopy = {
  name: 'Tính protein',
  blurb: 'Mỗi ngày cần bao nhiêu gram đạm theo cân nặng và mục tiêu.',
  metaTitle: 'Tính Protein: Mỗi Ngày Nên Ăn Bao Nhiêu Gram Đạm?',
  description:
    'Ăn bao nhiêu protein mỗi ngày để khỏe, tăng cơ hay giảm mỡ giữ cơ, theo khuyến nghị nghiên cứu (ISSN, Morton 2018). Miễn phí.',
  title: 'Tính protein',
  lead: 'Lượng đạm bạn cần phụ thuộc chủ yếu vào hai thứ: bạn nặng bao nhiêu và bạn đang tập cho mục tiêu gì. Chọn mục tiêu, công cụ cho bạn khoảng gram mỗi ngày mà nghiên cứu ủng hộ.',
  sections: [
    {
      heading: 'Các mức khuyến nghị và nguồn gốc',
      paragraphs: [
        'Để khỏe mạnh bình thường, mức tối thiểu chính thức (RDA) là 0,8 g cho mỗi kg cân nặng mỗi ngày. Đây là mức để không bị thiếu đạm, không phải mức để tăng hay giữ cơ.',
        'Nếu bạn tập tạ hoặc tập thể thao đều, Hiệp hội Dinh dưỡng Thể thao Quốc tế (ISSN) khuyến nghị 1,4–2,0 g mỗi kg. Một phân tích tổng hợp 49 nghiên cứu năm 2018 (Morton và cộng sự) cho thấy trung bình ăn quá khoảng 1,6 g/kg thì cơ không tăng thêm, dù một số người vẫn hưởng lợi đến khoảng 2,2 g/kg.',
        'Khi ăn thâm hụt calo, đạm giúp giữ lại phần cơ bạn đang có. Với người đã tập tạ và khá gọn, ISSN gợi ý 2,3–3,1 g cho mỗi kg khối nạc (cân nặng trừ mỡ). Nhập tỷ lệ mỡ cơ thể, công cụ sẽ dùng khoảng này; nếu không nhập, công cụ giữ khoảng tính theo cân nặng.',
      ],
    },
    {
      heading: 'Ví dụ cụ thể',
      paragraphs: [
        'Bạn nữ nặng 55 kg: khoảng 44 g mỗi ngày để khỏe bình thường, 77–110 g nếu tập đều (khoảng 88 g ở mức 1,6 g/kg).',
        'Bạn nam nặng 70 kg, mỡ 20%, đang siết cân: khối nạc 56 kg, nên khoảng 129–174 g đạm mỗi ngày.',
      ],
    },
    {
      heading: '88 g đạm trông như thế nào trong bữa ăn Việt?',
      paragraphs: [
        'Khoảng: 2 quả trứng buổi sáng (12 g), một tô phở bò có khoảng 70 g thịt (khoảng 18 g), 1 hộp sữa chua không đường (khoảng 4 g), bữa tối 150 g ức gà hoặc cá (khoảng 40 g) và 100 g đậu phụ sốt cà chua (khoảng 11 g). Phần còn lại đến từ cơm, sữa, các loại đậu. Chia đều cho 3–4 bữa sẽ tốt hơn dồn vào một bữa.',
      ],
    },
    {
      heading: 'Ăn nhiều đạm có hại thận không?',
      paragraphs: [
        'Với người trưởng thành khỏe mạnh, ăn trong các khoảng trên chưa được chứng minh là gây hại thận hay xương. Nếu bạn đã có bệnh thận, hãy hỏi bác sĩ trước khi tăng đạm. Giới hạn thực tế thường là tiền và cảm giác ngán, không phải sức khỏe.',
      ],
    },
  ],
  sources: [SOURCES.dri, SOURCES.issn, SOURCES.morton],
};
