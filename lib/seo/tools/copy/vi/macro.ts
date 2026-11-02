import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const macro: ToolCopy = {
  name: 'Tính macro',
  blurb: 'Đổi số calo thành gram đạm, tinh bột và chất béo.',
  metaTitle: 'Tính Macro: Bao Nhiêu Gram Đạm, Tinh Bột, Chất Béo?',
  description:
    'Đổi mục tiêu calo thành gram protein, carb và fat theo ba cách chia của app Kallo. Miễn phí, có ví dụ và giải thích.',
  title: 'Tính macro',
  lead: 'Calo cho biết ăn bao nhiêu, còn macro cho biết ăn gì: đạm (protein), tinh bột (carb) và chất béo (fat). Nhập mục tiêu calo, hoặc để công cụ tự tính từ số đo của bạn, rồi chọn cách chia. Bạn sẽ có số gram cụ thể để nhắm tới.',
  sections: [
    {
      heading: 'Từ calo ra gram',
      paragraphs: [
        'Mỗi gram đạm và tinh bột cho khoảng 4 kcal, mỗi gram chất béo khoảng 9 kcal. Cách chia là phần trăm calo dành cho từng nhóm. Với 1.600 kcal và 30% đạm: 1.600 × 0,30 = 480 kcal, chia 4 = 120 g đạm.',
      ],
    },
    {
      heading: 'Ba cách chia',
      paragraphs: [
        'Cân bằng (30% đạm, 35% béo, 35% tinh bột) hợp với đa số người. Với 1.600 kcal: 120 g đạm, 62 g béo, 140 g tinh bột.',
        'Nhiều đạm (40 / 40 / 20) ít tinh bột, nhiều đạm, giúp no lâu và giữ cơ khi giảm cân. Với 1.600 kcal: 160 g đạm, 71 g béo, 80 g tinh bột. Lưu ý: 80 g tinh bột chỉ khoảng hai chén cơm cho cả ngày, khá khó với bữa cơm Việt.',
        'Năng động (30 / 20 / 50) nhiều tinh bột nhất, hợp với người tập nặng hoặc ăn cơm, bún, phở hằng ngày. Với 1.600 kcal: 120 g đạm, 36 g béo, 200 g tinh bột.',
        'Đây đúng là ba lựa chọn trong app Kallo khi bạn đăng ký.',
      ],
    },
    {
      heading: 'Nên chọn cách nào?',
      paragraphs: [
        'Cách mà bạn ăn được lâu dài. Muốn giảm hay tăng cân thì tổng calo quan trọng hơn nhiều so với cách chia; cách chia chủ yếu quyết định bạn no đến đâu và tập có sức không. Hãy chắc là đạm đủ (công cụ tính protein cho bạn khoảng phù hợp), phần còn lại để tinh bột và chất béo theo thói quen ăn uống của bạn.',
      ],
    },
    {
      heading: 'Đạt macro mà không cần cân từng món',
      paragraphs: [
        'Nhớ vài mốc là đủ để ước lượng đạm sai lệch chỉ 10–20 g: 100 g ức gà luộc có khoảng 31 g đạm, 1 quả trứng gà khoảng 6 g, 100 g đậu phụ khoảng 11 g, 1 hộp sữa chua có đường khoảng 3–4 g. Tinh bột và chất béo khó thấy hơn vì nằm trong chén cơm, dầu xào và nước sốt. Ghi bữa ăn bằng lời đúng như bạn đã ăn là cách nhanh nhất để thấy gram của mình đi đâu.',
      ],
    },
  ],
  sources: [SOURCES.dri, SOURCES.issn],
};
