import type { HubCopy, ToolUi } from '../../types';

export const hub: HubCopy = {
  metaTitle: 'Công Cụ Tính TDEE, Thâm Hụt Calo, Macro, Protein, BMI',
  description:
    'Tính TDEE, thâm hụt calo, macro, protein và BMI chuẩn châu Á miễn phí, cùng công thức với app Kallo. Không cần đăng ký.',
  title: 'Công cụ tính',
  lead: 'Những con số đằng sau việc ăn kiêng, tính bằng đúng các công thức Kallo dùng khi đặt mục tiêu calo cho bạn. Mỗi trang đều ghi rõ cách tính và nguồn.',
  more: 'Công cụ khác',
  tryLine:
    'Kallo tự đặt các mục tiêu này cho bạn khi đăng ký, rồi tính calo từ một câu bình thường như "1 tô phở bò tái, thêm 1 quẩy, ly trà đá".',
  sourcesHeading: 'Nguồn',
};

export const ui: ToolUi = {
  units: 'Đơn vị',
  metric: 'kg / cm',
  imperial: 'lb / ft',
  sex: 'Giới tính',
  male: 'Nam',
  female: 'Nữ',
  age: 'Tuổi',
  years: '',
  weight: 'Cân nặng',
  height: 'Chiều cao',
  activity: 'Mức vận động',
  activityLevels: {
    sedentary: 'Ít vận động: làm văn phòng, hầu như không tập',
    light: 'Nhẹ: tập 1–3 buổi mỗi tuần',
    moderate: 'Vừa: tập 3–5 buổi mỗi tuần',
    very_active: 'Nhiều: tập nặng 6–7 buổi mỗi tuần',
  },
  kcalPerDay: 'kcal mỗi ngày',
  bmr: 'BMR',
  bmrHint: 'đốt khi nằm yên hoàn toàn',
  tdee: 'TDEE (calo duy trì)',
  tdeeHint: 'ăn mức này thì cân đứng yên',
  loseHalf: 'Để giảm 0,5 kg mỗi tuần',
  gainQuarter: 'Để tăng 0,25 kg mỗi tuần',
  goalWeight: 'Cân nặng mục tiêu',
  pace: 'Tốc độ',
  perWeek: 'mỗi tuần',
  dailyTarget: 'Mỗi ngày nên ăn',
  reachBy: 'Dự kiến đạt khoảng',
  weeks: 'tuần',
  floored:
    'Đã giữ ở mức tối thiểu Kallo cho phép ({floor} kcal), nên tốc độ thật khoảng {pace} kg mỗi tuần.',
  unreachable:
    'Ở mức tối thiểu Kallo cho phép ({floor} kcal) bạn sẽ không giảm được cân, vì calo duy trì của bạn đã thấp như vậy. Vận động nhiều hơn sẽ nâng mức này lên.',
  noLoss: 'không giảm được ở mức tối thiểu',
  sameWeight: 'Mục tiêu bằng cân nặng hiện tại: ăn ở mức calo duy trì.',
  calories: 'Calo mỗi ngày',
  split: 'Cách chia',
  splits: {
    moderate_carb: {
      label: 'Cân bằng',
      desc: '30% đạm, 35% béo, 35% tinh bột',
    },
    lower_carb: { label: 'Nhiều đạm', desc: '40% đạm, 40% béo, 20% tinh bột' },
    higher_carb: { label: 'Năng động', desc: '30% đạm, 20% béo, 50% tinh bột' },
  },
  protein: 'Đạm',
  carbs: 'Tinh bột',
  fat: 'Chất béo',
  gramsPerDay: 'g mỗi ngày',
  goal: 'Mục tiêu',
  proteinGoals: {
    health: 'Khỏe bình thường',
    muscle: 'Tăng cơ',
    cut: 'Giảm mỡ, giữ cơ',
  },
  bodyFat: 'Tỷ lệ mỡ',
  optional: 'không bắt buộc',
  perKgBody: 'g cho mỗi kg cân nặng',
  perKgLean: 'g cho mỗi kg khối nạc',
  bmi: 'BMI',
  standardWho: 'Thang WHO',
  standardAsia: 'Thang châu Á',
  bands: {
    under: 'Gầy',
    normal: 'Bình thường',
    over: 'Thừa cân',
    obese: 'Béo phì',
  },
  normalRange: 'Cân nặng bình thường với chiều cao của bạn',
  fillIn:
    'Nhập số đo hợp lý ở trên (người trưởng thành, 30–300 kg) để xem kết quả.',
};
