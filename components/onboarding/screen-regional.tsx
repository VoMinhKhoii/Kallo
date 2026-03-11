'use client';

import { useEffect, useState } from 'react';
import type { RegionalProfile } from '@/lib/onboarding/types';

interface ScreenRegionalProps {
  defaultValues: {
    regionalProfile?: RegionalProfile | null;
  };
  onChange: (data: { regionalProfile: RegionalProfile }) => void;
}

const REGION_CARDS: {
  value: RegionalProfile;
  title: string;
  quote: string;
  detail: string;
}[] = [
  {
    value: 'mien_bac',
    title: 'Miền Bắc',
    quote: 'Thanh đạm, cân bằng.',
    detail:
      'Ít dầu mỡ, ít ngọt — AI mặc định nêm nếm nhẹ nhàng, giữ nguyên vị tự nhiên của nguyên liệu.',
  },
  {
    value: 'mien_trung',
    title: 'Miền Trung',
    quote: 'Đậm đà, tròn vị.',
    detail:
      'Gia vị phong phú, mắm đặc trưng — AI mặc định đậm hơn về muối và gia vị, khẩu phần cô đọng.',
  },
  {
    value: 'mien_nam',
    title: 'Miền Nam',
    quote: 'Ngọt dịu, phong phú.',
    detail:
      'Vị ngọt nhẹ xuất hiện trong hầu hết các món — AI tự động cộng thêm lượng đường nhỏ cho món kho và xào.',
  },
  {
    value: 'mien_tay',
    title: 'Miền Tây',
    quote: 'Béo ngậy, ngọt sâu.',
    detail:
      'Nước cốt dừa và đường là linh hồn — AI mặc định lượng chất béo và carb cao hơn cho các món kho, canh, xào.',
  },
];

export function ScreenRegional({
  defaultValues,
  onChange,
}: ScreenRegionalProps) {
  const [selected, setSelected] = useState<RegionalProfile | null>(
    defaultValues.regionalProfile ?? null
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    if (selected) {
      onChange({ regionalProfile: selected });
    }
  }, []);

  const handleSelect = (value: RegionalProfile) => {
    setSelected(value);
    onChange({ regionalProfile: value });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2
          className="mb-2 font-medium text-2xl text-[#2C2416] tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Regional Profile
        </h2>
        <p
          className="text-[#8B8682] text-[15px] leading-relaxed"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          AI uses this to infer default seasoning, oil usage, and portion styles
          when details are missing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {REGION_CARDS.map((region) => {
          const isSelected = selected === region.value;
          return (
            <button
              key={region.value}
              type="button"
              onClick={() => handleSelect(region.value)}
              className={`flex flex-col gap-2 rounded-2xl border p-5 text-left transition-all ${
                isSelected
                  ? 'border-[#C9A87C] bg-[#C9A87C]/5 shadow-sm'
                  : 'border-[#EAE7E0] bg-white hover:border-[#C9A87C]/50'
              }`}
            >
              <h3 className="font-medium text-[#2C2416] text-[16px]">
                {region.title}
              </h3>
              <p
                className="font-medium text-[#8B8682] text-[13px] italic"
                style={{ fontFamily: 'Lora, serif' }}
              >
                &ldquo;{region.quote}&rdquo;
              </p>
              <p className="text-[#8B8682] text-[13px] leading-relaxed">
                {region.detail}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
