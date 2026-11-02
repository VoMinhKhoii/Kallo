import type { ToolCopy } from '../../types';
import { SOURCES } from '../sources';

export const bmiCopy: ToolCopy = {
  name: 'Tính BMI',
  blurb: 'Chỉ số BMI theo cả thang WHO và thang châu Á.',
  metaTitle: 'Tính BMI Chuẩn Châu Á Và WHO: Bạn Có Thừa Cân?',
  description:
    'Tính chỉ số BMI và xem theo cả thang WHO lẫn thang châu Á (thừa cân từ 23) mà bệnh viện Việt Nam dùng. Miễn phí, không cần đăng ký.',
  title: 'Tính BMI',
  lead: 'BMI (chỉ số khối cơ thể) là cân nặng chia cho bình phương chiều cao. Đây là chỉ số sàng lọc nhanh, không phải chẩn đoán, và ngưỡng thừa cân còn tùy bạn dùng thang nào. Công cụ này cho bạn xem cùng lúc thang WHO quốc tế và thang châu Á.',
  sections: [
    {
      heading: 'Cách tính BMI',
      paragraphs: [
        'BMI = cân nặng (kg) ÷ (chiều cao tính bằng mét)². Ví dụ cao 1,60 m, nặng 60 kg: 60 ÷ (1,6 × 1,6) = 23,4.',
      ],
    },
    {
      heading: 'Thang WHO và thang châu Á khác nhau thế nào?',
      paragraphs: [
        'Thang WHO quốc tế: dưới 18,5 là gầy, 18,5–24,9 bình thường, 25–29,9 thừa cân, từ 30 trở lên béo phì.',
        'Người châu Á thường có tỷ lệ mỡ cao hơn và mắc tiểu đường type 2, bệnh tim mạch ở mức BMI thấp hơn người châu Âu. Vì vậy năm 2000, Văn phòng WHO khu vực Tây Thái Bình Dương cùng IASO và IOTF đề xuất thang châu Á - Thái Bình Dương (hay gọi là thang IDI & WPRO): 18,5–22,9 bình thường, 23–24,9 thừa cân, từ 25 trở lên béo phì. Các bệnh viện ở Việt Nam dùng thang này.',
        'Nên bạn cao 1,60 m nặng 60 kg ở ví dụ trên là "bình thường" theo WHO nhưng đã "thừa cân" theo thang châu Á. Với chiều cao này, cân nặng bình thường theo thang châu Á là khoảng 47–59 kg.',
      ],
    },
    {
      heading: 'BMI không nói được gì?',
      paragraphs: [
        'BMI không phân biệt được cơ và mỡ, nên người tập tạ nhiều cơ hay bị xếp vào "thừa cân". BMI cũng không cho biết mỡ nằm ở đâu, trong khi mỡ bụng nguy hiểm hơn mỡ ở hông, đùi. Vòng eo là phép đo thứ hai nên làm: cùng báo cáo châu Á - Thái Bình Dương đặt ngưỡng nguy cơ ở 90 cm với nam và 80 cm với nữ.',
        'BMI cũng không dùng cho trẻ em, phụ nữ mang thai, hay người lớn tuổi đang mất cơ; các trường hợp này cần biểu đồ riêng.',
      ],
    },
    {
      heading: 'Muốn đưa BMI về mức bình thường',
      paragraphs: [
        'BMI chỉ thay đổi khi cân nặng thay đổi, mà cân nặng đi theo lượng calo qua nhiều tuần. Công cụ tính TDEE cho bạn mức calo duy trì, công cụ tính thâm hụt calo cho số calo mỗi ngày và ngày dự kiến đạt mục tiêu. Việc còn lại là biết mình thật sự ăn bao nhiêu.',
      ],
    },
  ],
  sources: [SOURCES.asiaPacific, SOURCES.whoAsia],
};
