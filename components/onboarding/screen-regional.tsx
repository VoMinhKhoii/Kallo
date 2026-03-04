'use client';

import { motion } from 'motion/react';
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
  description: string;
}[] = [
  {
    value: 'mien_bac',
    title: 'Miền Bắc',
    description:
      'Thanh đạm, cân bằng. Ít dầu mỡ, ít ngọt — AI mặc định nêm nếm nhẹ nhàng, giữ nguyên vị tự nhiên của nguyên liệu.',
  },
  {
    value: 'mien_trung',
    title: 'Miền Trung',
    description:
      'Đậm đà, tròn vị. Gia vị phong phú, mắm đặc trưng — AI mặc định đậm hơn về muối và gia vị, khẩu phần cô đọng và tập trung hơn.',
  },
  {
    value: 'mien_nam',
    title: 'Miền Nam',
    description:
      'Ngọt dịu, phong phú. Vị ngọt nhẹ xuất hiện trong hầu hết các món — AI tự động cộng thêm lượng đường nhỏ cho món kho và xào.',
  },
  {
    value: 'mien_tay',
    title: 'Miền Tây',
    description:
      'Béo ngậy, ngọt sâu. Nước cốt dừa và đường là linh hồn của bếp miền Tây — AI mặc định lượng chất béo và carb cao hơn cho các món kho, canh, xào.',
  },
];

const REGION_ACCENT: Record<string, string> = {
  mien_bac: '#7C9A7C',
  mien_trung: '#C9A87C',
  mien_nam: '#D4A09A',
  mien_tay: '#8B7355',
};

export function ScreenRegional({
  defaultValues,
  onChange,
}: ScreenRegionalProps) {
  const [selected, setSelected] = useState<RegionalProfile | null>(
    defaultValues.regionalProfile ?? null
  );

  // Report on mount if resuming with pre-selected value
  useEffect(() => {
    if (selected) {
      onChange({ regionalProfile: selected });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (value: RegionalProfile) => {
    setSelected(value);
    onChange({ regionalProfile: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="font-semibold text-[#2C2416] text-lg"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Vùng miền ẩm thực của bạn
        </h2>
        <p
          className="mt-1.5 text-[#6B5D4F] text-sm"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          AI sẽ điều chỉnh ước lượng gia vị và cách nấu theo vùng miền bạn chọn.
        </p>
      </div>

      <div className="space-y-3">
        {REGION_CARDS.map((region, index) => {
          const isSelected = selected === region.value;
          const accent = REGION_ACCENT[region.value];
          return (
            <motion.button
              key={region.value}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.08,
                duration: 0.4,
                ease: 'easeOut',
              }}
              onClick={() => handleSelect(region.value)}
              className={`relative w-full rounded-xl border border-l-4 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-[#C9A87C] bg-[#C9A87C]/5 ring-1 ring-[#C9A87C]/40'
                  : 'border-[#E8D5B5]/60 bg-[#FEFBF6] hover:border-[#C9A87C]/40 hover:bg-[#C9A87C]/[0.02]'
              }`}
              style={{ borderLeftColor: accent }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3
                    className="font-medium text-[#2C2416] text-base"
                    style={{ fontFamily: 'Lora, serif' }}
                  >
                    {region.title}
                  </h3>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2C2416]"
                    >
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </motion.div>
                  )}
                </div>
                <p
                  className="mt-1.5 text-[#6B5D4F] text-sm leading-relaxed"
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {region.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
