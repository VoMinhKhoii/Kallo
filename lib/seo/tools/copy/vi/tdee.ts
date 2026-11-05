import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const tdee: ToolCopy = {
  name: 'Tính TDEE',
  blurb: 'Lượng calo bạn đốt trong một ngày bình thường.',
  metaTitle: 'Tính TDEE: Bạn Cần Bao Nhiêu Calo Mỗi Ngày?',
  description:
    'Tính TDEE và BMR theo công thức Mifflin-St Jeor mà app Kallo dùng. Miễn phí, không cần đăng ký, có giải thích cách tính từng bước.',
  title: 'Tính TDEE',
  lead: 'TDEE (tổng năng lượng tiêu hao mỗi ngày) là số calo cơ thể bạn đốt trong một ngày bình thường. Ăn xấp xỉ TDEE thì cân nặng đứng yên, ăn ít hơn thì giảm, ăn nhiều hơn thì tăng. Điền bốn con số bên dưới, kết quả hiện ngay khi bạn gõ.',
  sections: [
    {
      heading: 'TDEE được tính thế nào?',
      paragraphs: [
        'Bước một là BMR, năng lượng cơ thể cần khi nằm yên hoàn toàn: để thở, giữ ấm, nuôi các cơ quan. Kallo dùng công thức Mifflin-St Jeor, công thức được một tổng quan năm 2005 đánh giá là sát thực tế nhất cho cả người gầy lẫn người thừa cân: 10 × cân nặng (kg) + 6,25 × chiều cao (cm) − 5 × tuổi, rồi cộng 5 nếu là nam hoặc trừ 161 nếu là nữ.',
        'Bước hai là nhân BMR với mức vận động: 1,2 nếu bạn ngồi nhiều và gần như không tập; 1,375 nếu tập nhẹ 1–3 buổi mỗi tuần; 1,55 nếu tập 3–5 buổi; 1,725 nếu tập nặng 6–7 buổi. Làm tròn kết quả để có TDEE. Kallo dùng các con số này để đặt mục tiêu calo khi bạn đăng ký.',
      ],
    },
    {
      heading: 'Ví dụ cụ thể',
      paragraphs: [
        'Bạn nữ 25 tuổi, cao 158 cm, nặng 55 kg, làm văn phòng, ít tập: BMR = 550 + 987,5 − 125 − 161 ≈ 1.252 kcal. Ít vận động nên × 1,2 = khoảng 1.502 kcal mỗi ngày.',
        'Bạn nam 28 tuổi, cao 170 cm, nặng 68 kg, đi gym 4 buổi mỗi tuần: BMR = 680 + 1.062,5 − 140 + 5 ≈ 1.608 kcal, × 1,55 = khoảng 2.492 kcal mỗi ngày.',
      ],
    },
    {
      heading: 'Chọn mức vận động cho đúng',
      paragraphs: [
        'Đa số mọi người tự đánh giá cao hơn thực tế. Làm văn phòng cộng 3 tiếng gym mỗi tuần là "vận động nhẹ", chưa phải "vừa". Nếu phân vân, hãy chọn mức thấp hơn: chọn thấp thì kết quả đến chậm hơn một chút, chọn cao thì có khi ăn mãi không giảm.',
      ],
    },
    {
      heading: 'Con số này chính xác đến đâu?',
      paragraphs: [
        'Với đa số người trưởng thành, Mifflin-St Jeor lệch khoảng 10% so với đo trong phòng thí nghiệm, tức là với TDEE 2.000 kcal có thể sai tới 200 kcal mỗi chiều. Người nhiều cơ thường đốt nhiều hơn công thức, người lớn tuổi hoặc rất ít vận động thường đốt ít hơn. Hãy coi đây là điểm xuất phát: ghi lại những gì bạn ăn trong 2–3 tuần, theo dõi cân nặng trung bình mỗi tuần, rồi chỉnh thêm hoặc bớt 100–200 kcal.',
      ],
    },
    {
      heading: 'Biết TDEE rồi thì làm gì?',
      paragraphs: [
        'TDEE là mốc để đặt mọi mục tiêu khác: muốn giảm cân thì ăn dưới TDEE (thâm hụt calo), muốn tăng cân thì ăn trên. Công cụ tính thâm hụt calo sẽ đổi cân nặng mục tiêu và tốc độ bạn muốn thành số calo mỗi ngày và ngày dự kiến đạt được. Phần khó nhất là biết mình thật sự ăn bao nhiêu: thêm một chén cơm, một muỗng dầu hay ly trà sữa buổi chiều làm lệch tổng nhiều hơn mọi sai số của công thức.',
      ],
    },
  ],
  sources: [SOURCES.mifflin, SOURCES.frankenfield],
};
